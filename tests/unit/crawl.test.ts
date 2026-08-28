import { describe, expect, it } from 'vitest';
import {
  normalizeUrl,
  registrableDomain,
  isSameSite,
  isExcludedPath,
  priorityOf,
  UrlFrontier,
} from '@/lib/crawl/url-frontier';
import {
  SourceRegistry,
  extractSourceRefs,
  isSourceRef,
} from '@/lib/crawl/source-registry';
import { isCrawlable, nonCrawlableReason } from '@/lib/research/policy';

/**
 * The crawler's judgement, tested without a network.
 *
 * These are the decisions that determine whether a 25-page budget is spent on
 * the pricing page or on six copies of the homepage under different query
 * strings — and whether the citations in a report point where they claim to.
 */

describe('URL normalisation', () => {
  it('collapses the variants that are the same page', () => {
    const canonical = normalizeUrl('https://example.com/about')!.url;

    for (const variant of [
      'https://example.com/about/',
      'https://example.com/about#team',
      'https://www.example.com/about',
      'https://EXAMPLE.com/about',
      'https://example.com:443/about',
      'https://example.com//about',
      'https://example.com/about?utm_source=newsletter&utm_medium=email',
      'https://example.com/about?fbclid=abc123',
    ]) {
      expect(normalizeUrl(variant)!.url, variant).toBe(canonical);
    }
  });

  it('treats parameters that select content as significant', () => {
    // Dropping these would merge genuinely different pages into one.
    const a = normalizeUrl('https://example.com/product?id=1')!.url;
    const b = normalizeUrl('https://example.com/product?id=2')!.url;
    expect(a).not.toBe(b);
  });

  it('orders query parameters so argument order stops mattering', () => {
    expect(normalizeUrl('https://example.com/x?b=2&a=1')!.url).toBe(
      normalizeUrl('https://example.com/x?a=1&b=2')!.url,
    );
  });

  it('never collapses the root path to nothing', () => {
    expect(normalizeUrl('https://example.com/')!.path).toBe('/');
  });

  it('refuses schemes and shapes we would never fetch', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,<h1>x</h1>',
      'mailto:someone@example.com',
      'ftp://example.com/file',
      'https://user:pass@example.com/',
      'not a url at all',
    ]) {
      expect(normalizeUrl(bad), bad).toBeNull();
    }
  });

  it('resolves relative links against the page they were found on', () => {
    expect(normalizeUrl('/pricing', 'https://example.com/about')!.url).toBe(
      'https://example.com/pricing',
    );
    expect(normalizeUrl('../contact', 'https://example.com/a/b/')!.path).toBe(
      '/a/contact',
    );
  });
});

describe('same-site detection', () => {
  it('handles compound public suffixes', () => {
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('www.example.com')).toBe('example.com');
    expect(registrableDomain('example.com')).toBe('example.com');
    expect(registrableDomain('a.b.c.example.com.au')).toBe('example.com.au');
  });

  it('treats subdomains of one site as the same site', () => {
    expect(isSameSite('blog.example.com', 'example.com')).toBe(true);
    expect(isSameSite('shop.example.co.uk', 'www.example.co.uk')).toBe(true);
  });

  it('does not treat two different sites as one', () => {
    expect(isSameSite('example.com', 'example.org')).toBe(false);
    expect(isSameSite('example.com', 'notexample.com')).toBe(false);
    // The classic near-miss: a suffix match that is not a domain match.
    expect(isSameSite('evil-example.com', 'example.com')).toBe(false);
  });
});

describe('path exclusion', () => {
  it.each([
    '/login',
    '/sign-in',
    '/my-account',
    '/cart',
    '/checkout',
    '/search',
    '/wp-admin/',
    '/logout',
    '/feed',
    '/brochure.pdf',
    '/assets/app.js',
    '/privacy',
    '/terms',
    '/tag/marketing',
    '/a/b/c/d/e/f/g',
  ])('excludes %s', (path) => {
    expect(isExcludedPath(path)).toBe(true);
  });

  it.each(['/', '/about', '/pricing', '/services/consulting', '/case-studies/acme'])(
    'keeps %s',
    (path) => {
      expect(isExcludedPath(path)).toBe(false);
    },
  );

  it('excludes faceted and paginated views, which generate infinite variants', () => {
    expect(isExcludedPath('/products', '?page=4')).toBe(true);
    expect(isExcludedPath('/products', '?sort=price&filter=blue')).toBe(true);
    expect(isExcludedPath('/products', '?id=7')).toBe(false);
  });
});

describe('crawl prioritisation', () => {
  it('puts the pages that describe a business ahead of its blog', () => {
    expect(priorityOf('/')).toBeGreaterThan(priorityOf('/pricing'));
    expect(priorityOf('/pricing')).toBeGreaterThan(priorityOf('/about'));
    expect(priorityOf('/about')).toBeGreaterThan(priorityOf('/team'));
    expect(priorityOf('/team')).toBeGreaterThan(priorityOf('/blog'));
  });

  it('prefers a shallower page to a deeper one of the same kind', () => {
    expect(priorityOf('/services')).toBeGreaterThan(priorityOf('/services/a/b'));
  });
});

describe('UrlFrontier', () => {
  it('hands back the highest-priority URL first, whatever order they arrived', () => {
    const frontier = new UrlFrontier('example.com');
    frontier.add('https://example.com/blog/a-post', 'link');
    frontier.add('https://example.com/team', 'link');
    frontier.add('https://example.com/pricing', 'link');
    frontier.add('https://example.com/', 'seed');

    expect(frontier.take()?.path).toBe('/');
    expect(frontier.take()?.path).toBe('/pricing');
    expect(frontier.take()?.path).toBe('/team');
    expect(frontier.take()?.path).toBe('/blog/a-post');
    expect(frontier.take()).toBeNull();
  });

  it('queues a page once however many times it is discovered', () => {
    const frontier = new UrlFrontier('example.com');
    expect(frontier.add('https://example.com/about', 'link')).toBe(true);
    expect(frontier.add('https://example.com/about/', 'link')).toBe(false);
    expect(frontier.add('https://www.example.com/about#x', 'link')).toBe(false);
    expect(frontier.add('https://example.com/about?utm_source=x', 'link')).toBe(false);
    expect(frontier.pending).toBe(1);
  });

  it('will not leave the site it was given', () => {
    const frontier = new UrlFrontier('example.com');
    expect(frontier.add('https://competitor.com/pricing', 'link')).toBe(false);
    expect(frontier.add('https://blog.example.com/post', 'link')).toBe(true);
  });
});

describe('source registry', () => {
  it('assigns stable, sequential references', () => {
    const registry = new SourceRegistry(50);
    const a = registry.register({ url: 'https://a.example/1', type: 'web_page' })!;
    const b = registry.register({ url: 'https://b.example/2', type: 'search_result' })!;

    expect(a.ref).toBe('S1');
    expect(b.ref).toBe('S2');
    expect(registry.get('S1')?.url).toBe('https://a.example/1');
  });

  /**
   * The property the whole citation system rests on. If a source's id could
   * change, every claim citing it would silently start pointing somewhere else.
   */
  it('never renumbers a source once it has an id', () => {
    const registry = new SourceRegistry(50);
    const first = registry.register({ url: 'https://a.example/1', type: 'web_page' })!;

    for (let i = 0; i < 20; i += 1) {
      registry.register({ url: `https://other.example/${i}`, type: 'web_page' });
    }

    expect(registry.get('S1')?.url).toBe(first.url);
    expect(registry.register({ url: 'https://a.example/1', type: 'web_page' })!.ref).toBe(
      'S1',
    );
  });

  it('treats one page seen twice as one source, not two corroborating ones', () => {
    const registry = new SourceRegistry(50);
    registry.register({ url: 'https://a.example/page', type: 'search_result' });
    registry.register({ url: 'https://a.example/page#section', type: 'web_page' });

    expect(registry.size).toBe(1);
  });

  it('upgrades a search result in place when the page is later actually read', () => {
    const registry = new SourceRegistry(50);
    const seen = registry.register({
      url: 'https://a.example/page',
      type: 'search_result',
      title: null,
    })!;
    expect(seen.fetched).toBe(false);

    const read = registry.register({
      url: 'https://a.example/page',
      type: 'web_page',
      title: 'Real title',
      httpStatus: 200,
      content: '<html></html>',
      fetched: true,
    })!;

    expect(read.ref).toBe(seen.ref);
    expect(read.fetched).toBe(true);
    expect(read.title).toBe('Real title');
    expect(read.contentHash).not.toBeNull();
    expect(registry.size).toBe(1);
  });

  it('refuses to grow past its budget', () => {
    const registry = new SourceRegistry(3);
    for (let i = 0; i < 10; i += 1) {
      registry.register({ url: `https://a.example/${i}`, type: 'web_page' });
    }
    expect(registry.size).toBe(3);
    expect(registry.isFull).toBe(true);
    expect(
      registry.register({ url: 'https://a.example/new', type: 'web_page' }),
    ).toBeNull();
  });

  it('recognises and extracts source references from text', () => {
    expect(isSourceRef('S1')).toBe(true);
    expect(isSourceRef('S9999')).toBe(true);
    expect(isSourceRef('Sx')).toBe(false);
    expect(isSourceRef('1')).toBe(false);

    expect(
      extractSourceRefs('Prices are published on the site (S3, S7).').sort(),
    ).toEqual(['S3', 'S7']);
    expect(extractSourceRefs('No references here')).toEqual([]);
  });

  it('renders a prompt list without excerpts, which are already in the context', () => {
    const registry = new SourceRegistry(10);
    registry.register({
      url: 'https://a.example/1',
      title: 'About',
      type: 'web_page',
      excerpt: 'A very long excerpt that should not be repeated in the source list',
    });

    const list = registry.toPromptList();
    expect(list).toContain('S1: https://a.example/1 — About');
    expect(list).not.toContain('very long excerpt');
  });
});

describe('platform crawl policy', () => {
  it.each([
    'https://www.instagram.com/someone',
    'https://tiktok.com/@someone',
    'https://uk.linkedin.com/in/someone',
    'https://x.com/someone',
    'https://www.facebook.com/somepage',
    'https://maps.google.com/place',
  ])('will not fetch %s ourselves', (url) => {
    expect(isCrawlable(url)).toBe(false);
    expect(nonCrawlableReason(url)).toContain('restricts automated access');
  });

  it('will fetch an ordinary company website', () => {
    expect(isCrawlable('https://example.com/about')).toBe(true);
    expect(nonCrawlableReason('https://example.com/about')).toBeNull();
  });

  it('is not fooled by a lookalike hostname', () => {
    // instagram.com.evil.test is not Instagram, and evil-instagram.com is not
    // either — but neither should be mistaken for the real one in either
    // direction.
    expect(isCrawlable('https://instagram.com.evil.test/x')).toBe(true);
    expect(isCrawlable('https://notinstagram.com/x')).toBe(true);
    expect(isCrawlable('https://media.instagram.com/x')).toBe(false);
  });
});
