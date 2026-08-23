import 'server-only';
import { PassThrough, type Readable } from 'node:stream';
import { once } from 'node:events';
import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
  createInflateRaw,
} from 'node:zlib';
import { AuditError } from '@/lib/errors';

/**
 * Response-body decoding.
 *
 * This exists because of a real production failure. The fetcher advertised
 * `Accept-Encoding: gzip, deflate` and then ran `Buffer.concat(chunks)
 * .toString('utf8')` over the raw stream. Every compressed response — which is
 * most of the web — was therefore stored and analysed as mojibake beginning
 * with the gzip magic number `1F 8B`. A perfectly ordinary page came back as
 * binary noise and was reported as having no content.
 *
 * The fix has to be streaming rather than buffer-then-inflate, for two reasons
 * that pull in opposite directions:
 *
 *   · A decompression bomb — a few kilobytes that expand to gigabytes — must
 *     never be allocated. We stop at the decoded ceiling and destroy the
 *     pipeline, so the peak allocation is the ceiling, not the payload.
 *   · A genuinely large page must still be usable. Buffering the compressed
 *     bytes and inflating at the end would mean a body clipped at the transfer
 *     cap is corrupt and unrecoverable, where identity encoding degrades
 *     gracefully. Streaming lets both truncate the same way.
 *
 * Every byte count this module reports is a *decoded* byte count. That was
 * ambiguous before and is the kind of ambiguity that makes a size limit mean
 * two different things in two different places.
 */

export const SUPPORTED_ENCODINGS = ['identity', 'gzip', 'deflate', 'br'] as const;
export type ContentEncoding = (typeof SUPPORTED_ENCODINGS)[number];

/** Advertised to servers. Kept beside the decoders so the two cannot drift. */
export const ACCEPT_ENCODING = 'gzip, deflate, br';

export interface DecodedBody {
  text: string;
  /** Decoded content bytes. This is what every limit is expressed in. */
  bytes: number;
  /** Bytes actually read off the socket. Observability only. */
  encodedBytes: number;
  encoding: ContentEncoding;
  /** True when the body was cut short at the decoded ceiling. */
  truncated: boolean;
}

export interface DecodeLimits {
  /** Ceiling on decoded content. */
  maxDecodedBytes: number;
  /**
   * Ceiling on compressed bytes read from the socket. Separate from the decoded
   * ceiling because a bomb is small on the wire and huge after inflation, while
   * an uncompressed monster is the other way round. One number cannot bound both.
   */
  maxEncodedBytes: number;
}

/**
 * Parses `Content-Encoding` into exactly one supported encoding.
 *
 * Stacked encodings (`gzip, br`) are legal HTTP and vanishingly rare in the
 * wild. Rather than implement a decoder chain that would almost never run — and
 * would therefore almost never be exercised by a test — we refuse them
 * explicitly. An unknown encoding is refused for the same reason: guessing at a
 * body we cannot decode is how the original bug produced binary "text".
 */
export function parseContentEncoding(header: string | null | undefined): ContentEncoding {
  const raw = (header ?? '').trim().toLowerCase();
  if (!raw) return 'identity';

  const parts = raw
    .split(',')
    .map((p) => p.split(';')[0]!.trim())
    .filter((p) => p.length > 0 && p !== 'identity');

  if (parts.length === 0) return 'identity';

  if (parts.length > 1) {
    throw new AuditError('UNSUPPORTED_CONTENT', `Stacked Content-Encoding: ${raw}`, {
      context: { contentEncoding: raw },
    });
  }

  const only = parts[0]!;
  if (only === 'gzip' || only === 'x-gzip') return 'gzip';
  if (only === 'deflate') return 'deflate';
  if (only === 'br') return 'br';

  throw new AuditError('UNSUPPORTED_CONTENT', `Unsupported Content-Encoding: ${only}`, {
    context: { contentEncoding: raw },
  });
}

/**
 * Distinguishes zlib-wrapped deflate from raw deflate.
 *
 * RFC 1950 says the first two bytes are a checked header: the low nibble of
 * CMF is the compression method (8 for deflate) and the 16-bit big-endian value
 * is a multiple of 31. Servers that send raw RFC 1951 streams under
 * `Content-Encoding: deflate` are technically wrong and entirely real, which is
 * why both decoders exist.
 */
function looksZlibWrapped(head: Buffer): boolean {
  if (head.length < 2) return true;
  const cmf = head[0]!;
  const flg = head[1]!;
  return (cmf & 0x0f) === 0x08 && ((cmf << 8) | flg) % 31 === 0;
}

function createDecompressor(encoding: ContentEncoding, head: Buffer) {
  switch (encoding) {
    case 'gzip':
      return createGunzip();
    case 'deflate':
      return looksZlibWrapped(head) ? createInflate() : createInflateRaw();
    case 'br':
      return createBrotliDecompress();
    case 'identity':
      throw new Error('createDecompressor called for identity');
  }
}

function toBuffer(chunk: unknown): Buffer {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
}

/** Reads an already-plain stream, stopping at the ceiling. */
async function readIdentity(
  source: Readable,
  maxDecodedBytes: number,
): Promise<DecodedBody> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  let truncated = false;

  for await (const chunk of source) {
    const buffer = toBuffer(chunk);
    bytes += buffer.length;

    if (bytes > maxDecodedBytes) {
      // The head of an HTML document carries the metadata that matters most, so
      // a clipped read is still worth keeping.
      const keep = buffer.length - (bytes - maxDecodedBytes);
      if (keep > 0) chunks.push(buffer.subarray(0, keep));
      bytes = maxDecodedBytes;
      truncated = true;
      source.destroy();
      break;
    }
    chunks.push(buffer);
  }

  return {
    text: Buffer.concat(chunks).toString('utf8'),
    bytes,
    encodedBytes: bytes,
    encoding: 'identity',
    truncated,
  };
}

/**
 * Reads and inflates a compressed stream under both ceilings.
 *
 * The input is pumped into a PassThrough that feeds the decompressor, and the
 * decompressor is consumed concurrently. `pipe` gives us backpressure for free:
 * if the consumer stops reading, the pump stops writing, which is what keeps a
 * bomb from being materialised while we are still deciding to reject it.
 */
async function readCompressed(
  source: Readable,
  encoding: Exclude<ContentEncoding, 'identity'>,
  limits: DecodeLimits,
): Promise<DecodedBody> {
  const iterator = source[Symbol.asyncIterator]();

  const first = await iterator.next();
  const head = first.done ? Buffer.alloc(0) : toBuffer(first.value);

  if (head.length === 0) {
    throw new AuditError('RESPONSE_DECODE_FAILED', 'Compressed body was empty', {
      context: { encoding },
    });
  }

  let encodedBytes = head.length;
  const input = new PassThrough();
  const decompressor = createDecompressor(encoding, head);
  input.pipe(decompressor);

  let pumpError: unknown = null;

  const pump = (async () => {
    try {
      if (!input.write(head)) await once(input, 'drain');
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        const buffer = toBuffer(next.value);
        encodedBytes += buffer.length;
        if (encodedBytes > limits.maxEncodedBytes) {
          // More compressed bytes than any real page needs. Stop reading; the
          // decoder gets a short stream and the consumer keeps what inflated.
          break;
        }
        if (!input.write(buffer)) await once(input, 'drain');
      }
      input.end();
    } catch (error) {
      // A destroyed PassThrough (the consumer hit the ceiling and tore down)
      // is an expected outcome, not a failure worth surfacing.
      if (!input.destroyed) pumpError = error;
      input.destroy();
    }
  })();

  const chunks: Buffer[] = [];
  let bytes = 0;
  let truncated = false;

  try {
    for await (const chunk of decompressor) {
      const buffer = toBuffer(chunk);
      bytes += buffer.length;

      if (bytes > limits.maxDecodedBytes) {
        const keep = buffer.length - (bytes - limits.maxDecodedBytes);
        if (keep > 0) chunks.push(buffer.subarray(0, keep));
        bytes = limits.maxDecodedBytes;
        truncated = true;
        break;
      }
      chunks.push(buffer);
    }
  } catch (cause) {
    throw new AuditError(
      'RESPONSE_DECODE_FAILED',
      `Could not decompress ${encoding} response`,
      { cause, context: { encoding, encodedBytes } },
    );
  } finally {
    // Unconditional teardown. On the truncation path nothing else closes these,
    // and a live zlib stream holds native memory until it is destroyed.
    decompressor.destroy();
    input.destroy();
    source.destroy();
    await pump.catch(() => {});
  }

  if (pumpError) {
    throw new AuditError('RESPONSE_DECODE_FAILED', 'Compressed body ended early', {
      cause: pumpError,
      context: { encoding, encodedBytes },
    });
  }

  return {
    text: Buffer.concat(chunks).toString('utf8'),
    bytes,
    encodedBytes,
    encoding,
    truncated,
  };
}

/**
 * Reads a response body, decoding it if the server compressed it.
 *
 * The caller passes the raw `Content-Encoding` header rather than a parsed
 * value so that the "unsupported encoding" decision is made in exactly one
 * place, next to the decoders that define what "supported" means.
 */
export async function readDecodedBody(
  source: Readable,
  contentEncodingHeader: string | null | undefined,
  limits: DecodeLimits,
): Promise<DecodedBody> {
  const encoding = parseContentEncoding(contentEncodingHeader);

  if (encoding === 'identity') {
    return readIdentity(source, limits.maxDecodedBytes);
  }
  return readCompressed(source, encoding, limits);
}
