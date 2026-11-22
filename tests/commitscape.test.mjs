import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function createStorageMock(maxKeys = Infinity) {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      if (!map.has(k) && map.size >= maxKeys) {
        throw new Error('QuotaExceededError');
      }
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    }
  };
}

function loadCommitscapeContext({ maxLocalKeys = Infinity, fetchImpl = null } = {}) {
  const localStorage = createStorageMock(maxLocalKeys);
  const sessionStorage = createStorageMock(Infinity);
  const windowObj = {
    localStorage,
    sessionStorage,
    Commitscape: {}
  };

  const ctx = vm.createContext({
    window: windowObj,
    fetch: fetchImpl || (() => Promise.reject(new Error('Mock fetch not configured'))),
    Intl,
    URL,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Boolean,
    Error,
    Promise,
    Buffer,
    Uint8Array,
    atob,
    TextDecoder,
    encodeURIComponent,
    setTimeout,
    clearTimeout
  });

  const scripts = [
    'src/utils/sanitize.js',
    'src/domain/linguistColors.js',
    'src/api/cacheStore.js',
    'src/api/githubClient.js',
    'src/domain/analytics.js'
  ];

  for (const rel of scripts) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
  }

  return {
    cs: windowObj.Commitscape,
    localStorage,
    sessionStorage
  };
}

describe('sanitize.js', () => {
  it('escapes HTML special characters against XSS', () => {
    const { cs } = loadCommitscapeContext();
    assert.equal(
      cs.utils.esc('<img src=x onerror="alert(1)">\'&'),
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;'
    );
  });

  it('validates safe URLs and blocks dangerous schemes', () => {
    const { cs } = loadCommitscapeContext();
    assert.equal(cs.utils.safeUrl('javascript:alert(1)'), '');
    assert.equal(cs.utils.safeUrl('data:text/html,<script>'), '');
    assert.equal(cs.utils.safeUrl('https://github.com/torvalds'), 'https://github.com/torvalds');
    assert.equal(cs.utils.safeUrl('github.blog'), 'https://github.blog/');
    assert.equal(cs.utils.safeUrl(''), '');
  });

  it('formats bytes and compact counts cleanly', () => {
    const { cs } = loadCommitscapeContext();
    assert.equal(cs.utils.formatBytes(512), '512 B');
    assert.equal(cs.utils.formatBytes(2048), '2.0 KB');
    assert.equal(cs.utils.formatCompact(950), '950');
    assert.equal(cs.utils.formatCompact(15400), '15.4k');
    assert.equal(cs.utils.formatCompact(2500000), '2.5M');
  });
});

describe('linguistColors.js', () => {
  it('returns official GitHub Linguist colors and deterministic fallback', () => {
    const { cs } = loadCommitscapeContext();
    assert.equal(cs.colors.getLangColor('TypeScript'), '#3178c6');
    assert.equal(cs.colors.getLangColor('Python'), '#3572A5');
    const customA = cs.colors.getLangColor('CustomLangXYZ', 0);
    const customB = cs.colors.getLangColor('CustomLangXYZ', 0);
    assert.equal(customA, customB);
    assert.match(customA, /^#[0-9a-f]{6}$/i);
  });

  it('builds safe inline vector icons for known languages and fallback badges', () => {
    const { cs } = loadCommitscapeContext();
    const pyIcon = cs.colors.getLangIconHtml('Python');
    assert.ok(pyIcon.includes('class="lang-logo-badge"'));
    assert.ok(pyIcon.includes('<svg viewBox="0 0 24 24"'));

    const tsIcon = cs.colors.getLangIconHtml('TypeScript');
    assert.ok(tsIcon.includes('>TS<'));

    const asmIcon = cs.colors.getLangIconHtml('Assembly');
    assert.ok(asmIcon.includes('>ASM<'));

    const aiUri = cs.colors.getLangSvgDataUri('cat:ai');
    const pyUri = cs.colors.getLangSvgDataUri('lang:Python');
    const reactUri = cs.colors.getLangSvgDataUri('stack:react');
    assert.ok(aiUri.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.ok(decodeURIComponent(aiUri).includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(pyUri.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.ok(reactUri.startsWith('data:image/svg+xml;charset=utf-8,'));

    const xssIcon = cs.colors.getLangIconHtml('<img onerror="x">');
    assert.ok(!xssIcon.includes('<img'));
    assert.ok(xssIcon.includes('<svg'));
  });
});

describe('cacheStore.js', () => {
  let cs;

  beforeEach(() => {
    ({ cs } = loadCommitscapeContext());
  });

  it('stores, reads fresh entries, detects expired TTL and touches ETag entries', () => {
    cs.cache.set('user:octocat', { login: 'octocat' }, '"etag-1"', 60_000);
    const hit = cs.cache.get('user:octocat');
    assert.equal(hit.hit, true);
    assert.equal(hit.fresh, true);
    assert.equal(hit.etag, '"etag-1"');
    assert.equal(hit.data.login, 'octocat');

    cs.cache.set('user:expired', { login: 'old' }, '"etag-2"', -10);
    const stale = cs.cache.get('user:expired');
    assert.equal(stale.hit, true);
    assert.equal(stale.fresh, false);

    cs.cache.touch('user:expired', 60_000);
    assert.equal(cs.cache.get('user:expired').fresh, true);
  });

  it('prunes oldest cache entries when storage quota is reached', () => {
    const { cs: bounded } = loadCommitscapeContext({ maxLocalKeys: 2 });
    bounded.cache.set('k1', { n: 1 }, null, 60_000);
    bounded.cache.set('k2', { n: 2 }, null, 60_000);
    bounded.cache.set('k3', { n: 3 }, null, 60_000);
    assert.equal(bounded.cache.get('k3').hit, true);
  });

  it('persists history, tokens and theme preferences', () => {
    cs.cache.pushHistory('torvalds');
    cs.cache.pushHistory('octocat');
    cs.cache.pushHistory('torvalds');
    assert.deepEqual(cs.cache.getHistory(), ['torvalds', 'octocat']);

    cs.cache.setToken('ghp_test123', false);
    assert.equal(cs.cache.getToken(), 'ghp_test123');
    assert.equal(cs.cache.getTokenPersistence(), 'session');
    cs.cache.clearToken();
    assert.equal(cs.cache.getToken(), '');

    assert.equal(cs.cache.setTheme('light'), 'light');
    assert.equal(cs.cache.getTheme(), 'light');
    assert.equal(cs.cache.setTheme('invalid'), 'midnight');
  });
});

describe('analytics.js', () => {
  it('computes profile stats, organization flags, bytes share and trophies', () => {
    const { cs } = loadCommitscapeContext();
    const user = {
      login: 'acme-org',
      name: 'Acme',
      type: 'Organization',
      followers: 420,
      public_repos: 3,
      created_at: '2016-05-01T00:00:00Z'
    };
    const repos = [
      { id: 1, name: 'core', fork: false, language: 'TypeScript', stargazers_count: 150, forks_count: 20, pushed_at: new Date().toISOString() },
      { id: 2, name: 'cli', fork: false, language: 'Rust', stargazers_count: 50, forks_count: 5, pushed_at: new Date().toISOString() },
      { id: 3, name: 'forked', fork: true, language: 'JavaScript', stargazers_count: 999, forks_count: 50 }
    ];
    const bytesMap = {
      core: { TypeScript: 9000, CSS: 1000 }
    };

    const profile = cs.analytics.buildProfileModel(user, repos, [], bytesMap, {
      orgMembers: [{ login: 'dev1', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' }]
    });

    assert.equal(profile.isOrg, true);
    assert.equal(profile.orgMembers.length, 1);
    assert.equal(profile.stats.ownReposCount, 2);
    assert.equal(profile.stats.totalStars, 200);
    assert.equal(profile.stats.totalForks, 25);
    assert.equal(profile.unanalyzedOwnCount, 1);
    assert.equal(profile.languagesByRepo[0].name, 'TypeScript');
    assert.equal(profile.languagesByBytes[0].name, 'TypeScript');
    assert.equal(profile.languagesByBytes[0].pct, 90);
    assert.equal(profile.activityMatrix.length, 70);
    assert.equal(profile.trophies.find((t) => t.id === 'stars').tier, 'plata');
  });

  it('builds annual 365-day activity matrix and duel Jaccard affinity', () => {
    const { cs } = loadCommitscapeContext();
    const cal = {
      totalContributions: 42,
      weeks: [
        {
          contributionDays: [
            { date: '2026-01-01', contributionCount: 0 },
            { date: '2026-01-02', contributionCount: 10 },
            { date: '2026-01-03', contributionCount: 2 },
            { date: '2026-01-04', contributionCount: 0 },
            { date: '2026-01-05', contributionCount: 5 },
            { date: '2026-01-06', contributionCount: 0 },
            { date: '2026-01-07', contributionCount: 25 }
          ]
        }
      ]
    };

    const annual = cs.analytics.buildAnnualActivityMatrix(cal);
    assert.equal(annual.totalContributions, 42);
    assert.equal(annual.activeDays, 4);
    assert.equal(annual.cells.length, 7);

    const profA = cs.analytics.buildProfileModel(
      { login: 'a', created_at: '2020-01-01T00:00:00Z' },
      [
        { name: 'r1', fork: false, language: 'TypeScript', stargazers_count: 10 },
        { name: 'r2', fork: false, language: 'Rust', stargazers_count: 5 }
      ]
    );
    const profB = cs.analytics.buildProfileModel(
      { login: 'b', created_at: '2021-01-01T00:00:00Z' },
      [
        { name: 'r3', fork: false, language: 'TypeScript', stargazers_count: 20 },
        { name: 'r4', fork: false, language: 'Python', stargazers_count: 4 }
      ]
    );

    const duel = cs.analytics.buildDuelModel(profA, profB);
    assert.equal(duel.affinityPct, 33);
    assert.deepEqual(duel.shared, ['TypeScript']);
    assert.deepEqual(duel.onlyA, ['Rust']);
    assert.deepEqual(duel.onlyB, ['Python']);
  });
});

describe('githubClient.js trending search', () => {
  it('builds trending queries for week, month and all-time windows', () => {
    const { cs } = loadCommitscapeContext();
    const refMs = Date.UTC(2026, 4, 20, 12, 0, 0);
    assert.equal(cs.api.buildTrendingQuery('week', refMs), 'created:>=2026-05-13');
    assert.equal(cs.api.buildTrendingQuery('month', refMs), 'created:>=2026-04-20');
    assert.equal(cs.api.buildTrendingQuery('all', refMs), 'stars:>50000');
  });

  it('falls back when weekly search is empty without overwriting core rateLimit', async () => {
    const calls = [];
    const mockFetch = async (url) => {
      calls.push(url);
      const isFallback = url.includes('stars%3A%3E5000');
      const body = isFallback
        ? { items: [{ id: 1, name: 'awesome-repo', stargazers_count: 9000, owner: { login: 'octocat' } }] }
        : { items: [] };
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            if (name === 'X-RateLimit-Limit') return '10';
            if (name === 'X-RateLimit-Remaining') return '8';
            return null;
          }
        },
        async json() {
          return body;
        }
      };
    };

    const { cs } = loadCommitscapeContext({ fetchImpl: mockFetch });
    const res = await cs.api.fetchTrendingRepos({ range: 'week', perPage: 12 });

    assert.equal(calls.length, 2);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].name, 'awesome-repo');
    assert.ok(res.fallbackNotice.length > 0);
    // Search bucket (10 req/min) must not overwrite core rate limit (60/hour)
    assert.equal(cs.api.getRateLimit().limit, 60);
    assert.equal(cs.api.getRateLimit().remaining, null);
  });

  it('builds 3-layer technology neural graph (categories -> languages -> stacks) with pathways', () => {
    const { cs } = loadCommitscapeContext();
    const sampleRepos = [
      {
        full_name: 'a/agent-kit',
        name: 'agent-kit',
        language: 'TypeScript',
        stargazers_count: 2400,
        topics: ['ai', 'mcp', 'agents'],
        description: 'Autonomous AI agent workflow for Claude and MCP'
      },
      {
        full_name: 'b/llm-cli',
        name: 'llm-cli',
        language: 'Rust',
        stargazers_count: 1900,
        topics: ['cli', 'llm'],
        description: 'Fast terminal AI inference runner'
      },
      {
        full_name: 'c/web-dash',
        name: 'web-dash',
        language: 'TypeScript',
        stargazers_count: 1200,
        topics: ['react', 'dashboard'],
        description: 'Modern React web UI dashboard'
      }
    ];

    const graph = cs.analytics.buildTechNeuralGraph(sampleRepos, {
      sourceKind: 'recent_7d',
      totalPublishedCount: 45000
    });
    assert.equal(graph.repoTotal, 3);
    assert.equal(graph.sampleSize, 3);
    assert.equal(graph.totalPublishedCount, 45000);
    assert.equal(graph.sourceKind, 'recent_7d');
    assert.equal(graph.nodes.filter((n) => n.layer === 0).length, 6);
    assert.equal(graph.nodes.filter((n) => n.layer === 1).length, 7);
    assert.equal(graph.nodes.filter((n) => n.layer === 2).length, 6);

    const tsNode = graph.nodes.find((n) => n.id === 'lang:TypeScript');
    const aiCat = graph.nodes.find((n) => n.id === 'cat:ai');
    const llmStack = graph.nodes.find((n) => n.id === 'stack:llm');
    assert.ok(tsNode && aiCat && llmStack);
    assert.equal(tsNode.repoCount, 2);
    assert.equal(tsNode.sharePct, 67);
    assert.deepEqual(Array.from(tsNode.repoKeys), ['a/agent-kit', 'c/web-dash']);
    assert.equal(aiCat.repoCount, 2);
    assert.equal(graph.defaultFocusId, 'cat:ai');
    assert.ok(aiCat.pathwayIds.includes('lang:Python'));
    assert.ok(aiCat.pathwayIds.includes('stack:llm'));
    assert.ok(!aiCat.pathwayIds.includes('stack:mobile'));
    assert.ok(Number.isFinite(tsNode.x) && Number.isFinite(tsNode.y) && Number.isFinite(tsNode.z));
    assert.ok(graph.edges.some((e) => e.source === 'cat:ai' && e.target === 'lang:TypeScript'));
    assert.ok(graph.edges.some((e) => e.source === 'lang:TypeScript' && e.target === 'stack:llm'));
  });

  it('fetchCategoryRepos queries search API without altering core rate limit', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          if (name === 'X-RateLimit-Limit') return '10';
          if (name === 'X-RateLimit-Remaining') return '9';
          return null;
        }
      },
      async json() {
        return { items: [{ id: 10, name: 'mcp-core', stargazers_count: 5000 }] };
      }
    });

    const { cs } = loadCommitscapeContext({ fetchImpl: mockFetch });
    const res = await cs.api.fetchCategoryRepos('topic:mcp', 'stack_llm', 12);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].name, 'mcp-core');
    assert.equal(cs.api.getRateLimit().limit, 60);
    assert.equal(cs.api.getRateLimit().remaining, null);
  });

  it('fetchRecentPublishedRepos gathers unbiased sort=updated sample across 2 pages and preserves core quota', async () => {
    const urls = [];
    const mockFetch = async (url) => {
      urls.push(url);
      const isPage2 = url.includes('&page=2');
      const items = isPage2
        ? [{ id: 2, full_name: 'u2/repo2', name: 'repo2', language: 'Go' }]
        : [
            { id: 1, full_name: 'u1/repo1', name: 'repo1', language: 'Python' },
            { id: 2, full_name: 'u2/repo2', name: 'repo2', language: 'Go' }
          ];
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            if (name === 'X-RateLimit-Limit') return '10';
            if (name === 'X-RateLimit-Remaining') return '7';
            return null;
          }
        },
        async json() {
          return { total_count: 125400, items };
        }
      };
    };

    const { cs } = loadCommitscapeContext({ fetchImpl: mockFetch });
    const res = await cs.api.fetchRecentPublishedRepos({ days: 7, pages: 2, perPage: 2 });

    assert.equal(urls.length, 2);
    assert.ok(urls[0].includes('sort=updated'));
    assert.equal(res.totalCount, 125400);
    assert.equal(res.items.length, 2);
    assert.equal(res.empty, false);
    assert.equal(cs.api.getRateLimit().limit, 60);
    assert.equal(cs.api.getRateLimit().remaining, null);
  });

  it('fetchRepoReadme decodes UTF-8 base64 README payloads and returns null on missing README', async () => {
    const encoded = Buffer.from('# Commitscape\n\nExplorador **3D** en español 🚀', 'utf8').toString('base64');
    const mockFetch = async (url) => {
      if (url.includes('/repos/octocat/empty/readme')) {
        return {
          ok: false,
          status: 404,
          headers: { get() { return null; } },
          async json() { return { message: 'Not Found' }; }
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async json() {
          return {
            name: 'README.md',
            encoding: 'base64',
            content: encoded,
            html_url: 'https://github.com/octocat/demo/blob/main/README.md'
          };
        }
      };
    };

    const { cs } = loadCommitscapeContext({ fetchImpl: mockFetch });
    const okReadme = await cs.api.fetchRepoReadme('octocat', 'demo');
    assert.equal(okReadme.name, 'README.md');
    assert.match(okReadme.markdown, /^# Commitscape/);
    assert.ok(okReadme.markdown.includes('español 🚀'));
    assert.equal(okReadme.htmlUrl, 'https://github.com/octocat/demo/blob/main/README.md');

    const missing = await cs.api.fetchRepoReadme('octocat', 'empty');
    assert.equal(missing, null);
  });
});
