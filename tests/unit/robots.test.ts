import { describe, expect, it } from 'vitest';
import { isPathAllowed, parseRobotsTxt, OUR_AGENT_TOKEN } from '@/lib/crawl/robots';

describe('parseRobotsTxt', () => {
  it('collects sitemap declarations', () => {
    const { sitemaps } = parseRobotsTxt(`
      User-agent: *
      Disallow:
      Sitemap: https://example.com/sitemap.xml
      Sitemap: https://example.com/news-sitemap.xml
    `);
    expect(sitemaps).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/news-sitemap.xml',
    ]);
  });

  it('groups consecutive user-agent lines into one rule block', () => {
    const { groups } = parseRobotsTxt(`
      User-agent: googlebot
      User-agent: bingbot
      Disallow: /private
    `);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.agents).toEqual(['googlebot', 'bingbot']);
    expect(groups[0]!.rules).toEqual([{ allow: false, path: '/private' }]);
  });

  it('starts a new group when a user-agent follows a rule', () => {
    const { groups } = parseRobotsTxt(`
      User-agent: googlebot
      Disallow: /a
      User-agent: *
      Disallow: /b
    `);
    expect(groups).toHaveLength(2);
  });

  it('ignores comments and blank lines', () => {
    const { groups } = parseRobotsTxt(`
      # a comment
      User-agent: *   # trailing comment
      Disallow: /admin
    `);
    expect(groups[0]!.rules).toEqual([{ allow: false, path: '/admin' }]);
  });
});

describe('isPathAllowed', () => {
  it('allows everything when robots.txt is empty', () => {
    expect(isPathAllowed('', '/')).toBe(true);
  });

  it('allows everything when no group applies to us', () => {
    expect(isPathAllowed('User-agent: googlebot\nDisallow: /', '/')).toBe(true);
  });

  it('honours a wildcard Disallow of the whole site', () => {
    expect(isPathAllowed('User-agent: *\nDisallow: /', '/')).toBe(false);
  });

  it('treats an empty Disallow as no restriction', () => {
    expect(isPathAllowed('User-agent: *\nDisallow:', '/')).toBe(true);
  });

  it('applies rules addressed to our agent by name', () => {
    const robots = `User-agent: ${OUR_AGENT_TOKEN}\nDisallow: /`;
    expect(isPathAllowed(robots, '/')).toBe(false);
  });

  it('prefers a group naming us over the wildcard group', () => {
    // The wildcard bans everything; our named group permits the homepage.
    const robots = [
      'User-agent: *',
      'Disallow: /',
      '',
      `User-agent: ${OUR_AGENT_TOKEN}`,
      'Allow: /',
    ].join('\n');
    expect(isPathAllowed(robots, '/')).toBe(true);
  });

  it('lets the longest matching rule win', () => {
    const robots = ['User-agent: *', 'Disallow: /blog', 'Allow: /blog/public'].join('\n');
    expect(isPathAllowed(robots, '/blog/private')).toBe(false);
    expect(isPathAllowed(robots, '/blog/public/post')).toBe(true);
  });

  it('lets Allow win a tie against Disallow', () => {
    const robots = ['User-agent: *', 'Disallow: /page', 'Allow: /page'].join('\n');
    expect(isPathAllowed(robots, '/page')).toBe(true);
  });

  it('honours the * wildcard inside a path', () => {
    const robots = ['User-agent: *', 'Disallow: /*.pdf'].join('\n');
    expect(isPathAllowed(robots, '/files/report.pdf')).toBe(false);
    expect(isPathAllowed(robots, '/files/report.html')).toBe(true);
  });

  it('honours a terminating $ anchor', () => {
    const robots = ['User-agent: *', 'Disallow: /page$'].join('\n');
    expect(isPathAllowed(robots, '/page')).toBe(false);
    expect(isPathAllowed(robots, '/page/sub')).toBe(true);
  });

  it('is case-insensitive about field names and agent tokens', () => {
    const robots = ['USER-AGENT: *', 'DISALLOW: /'].join('\n');
    expect(isPathAllowed(robots, '/')).toBe(false);
  });

  it('ignores rules that appear before any user-agent line', () => {
    expect(isPathAllowed('Disallow: /\nUser-agent: *\nAllow: /', '/')).toBe(true);
  });

  it('allows a homepage when only deep paths are disallowed', () => {
    const robots = [
      'User-agent: *',
      'Disallow: /wp-admin/',
      'Disallow: /cart',
      'Disallow: /checkout',
    ].join('\n');
    expect(isPathAllowed(robots, '/')).toBe(true);
  });
});
