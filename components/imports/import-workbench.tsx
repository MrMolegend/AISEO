'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/panel';

/**
 * The import workbench: paste or choose a CSV, read exactly what it would
 * do, then commit. The server recomputes the same preview before writing,
 * so what you read here is what happens. Committing twice converges, and
 * an import can be undone while its accounts are still untouched.
 */

interface PreviewRow {
  line: number;
  name: string;
  segmentKey: string | null;
  territoryKey: string | null;
  websiteUrl: string | null;
  error: string | null;
  duplicate: boolean;
}

interface Preview {
  rows: PreviewRow[];
  creatable: number;
  duplicates: number;
  errors: number;
}

export function ImportWorkbench() {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [committed, setCommitted] = useState<{
    created: number;
    existed: number;
    skipped: number;
    createdIds: string[];
  } | null>(null);
  const [undone, setUndone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message ?? 'The request failed.');
    }
    return payload;
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(typeof reader.result === 'string' ? reader.result : '');
      setPreview(null);
      setCommitted(null);
      setUndone(null);
    };
    reader.readAsText(file);
  }

  return (
    <div>
      {failure && (
        <p role="alert" className="text-copper mb-4 text-[13px]">
          {failure}
        </p>
      )}

      <div className="max-w-3xl">
        <label
          htmlFor="import-text"
          className="text-text mb-2 block text-[13px] font-medium"
        >
          CSV rows (name, segment, territory, website, notes)
        </label>
        <textarea
          id="import-text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
            setCommitted(null);
            setUndone(null);
          }}
          rows={8}
          spellCheck={false}
          className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 font-mono text-[13px]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-text-muted cursor-pointer text-[13px] underline-offset-2 hover:underline">
            …or choose a file
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => readFile(event.target.files?.[0])}
            />
          </label>
          <a
            href="/api/imports/template"
            className="text-text-muted text-[13px] underline-offset-2 hover:underline"
          >
            Download the template
          </a>
          <Button
            disabled={busy || !text.trim()}
            onClick={() =>
              void run(async () => {
                const payload = await post('/api/imports/preview', { text });
                setPreview(payload.preview);
                setCommitted(null);
                setUndone(null);
              })
            }
          >
            Preview
          </Button>
        </div>
      </div>

      {preview && (
        <>
          <Rule label="What this file would do" className="mt-10" />
          <p className="text-text-muted mt-3 text-[13px]">
            {preview.creatable} to create · {preview.duplicates} already known ·{' '}
            {preview.errors} row{preview.errors === 1 ? '' : 's'} with problems.
          </p>
          <div className="border-rule mt-4 max-h-96 overflow-auto border">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-rule text-text-subtle border-b">
                  <th className="px-3 py-2 font-medium" data-numeric>
                    Line
                  </th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-rule divide-y">
                {preview.rows.map((row) => (
                  <tr key={row.line}>
                    <td className="text-text-subtle px-3 py-2" data-numeric>
                      {row.line}
                    </td>
                    <td className="text-text px-3 py-2">{row.name || '—'}</td>
                    <td className="px-3 py-2">
                      {row.error ? (
                        <span className="text-copper">{row.error}</span>
                      ) : row.duplicate ? (
                        <span className="text-text-subtle">Already known — skipped</span>
                      ) : (
                        <span className="text-signal">Will be created</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.creatable > 0 && !committed && (
            <div className="mt-4">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const payload = await post('/api/imports/commit', { text });
                    setCommitted(payload.result);
                  })
                }
              >
                Import {preview.creatable} account{preview.creatable === 1 ? '' : 's'}
              </Button>
            </div>
          )}
        </>
      )}

      {committed && (
        <div className="border-rule mt-8 max-w-3xl border p-5">
          <p role="status" className="text-text text-[14px]">
            Imported {committed.created} account{committed.created === 1 ? '' : 's'};{' '}
            {committed.existed} already existed; {committed.skipped} skipped.
          </p>
          {committed.created > 0 && undone === null && (
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const payload = await post('/api/imports/undo', {
                      accountIds: committed.createdIds,
                    });
                    setUndone(payload.reverted);
                  })
                }
              >
                Undo this import
              </Button>
              <p className="text-text-subtle mt-2 text-[12px]">
                Undo rejects the accounts this import created, as long as nobody has
                started working them.
              </p>
            </div>
          )}
          {undone !== null && (
            <p role="status" className="text-text-muted mt-3 text-[13px]">
              {undone} account{undone === 1 ? '' : 's'} reverted to rejected.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
