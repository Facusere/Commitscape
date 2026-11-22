(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const BASE = 'https://api.github.com';
  let rateLimitListener = null;
  let lastRateLimit = {
    limit: 60,
    remaining: null,
    resetAt: null,
    authenticated: false
  };

  function setRateLimitListener(fn) {
    rateLimitListener = fn;
  }

  function getRateLimit() {
    return { ...lastRateLimit };
  }

  function readRateHeaders(res, hasToken) {
    const limit = Number(res.headers.get('X-RateLimit-Limit'));
    const remainingHeader = res.headers.get('X-RateLimit-Remaining');
    const reset = Number(res.headers.get('X-RateLimit-Reset'));

    if (!Number.isNaN(limit) && limit > 0) {
      lastRateLimit.limit = limit;
    } else {
      lastRateLimit.limit = hasToken ? 5000 : 60;
    }
    if (remainingHeader !== null && !Number.isNaN(Number(remainingHeader))) {
      lastRateLimit.remaining = Number(remainingHeader);
    }
    if (!Number.isNaN(reset) && reset > 0) {
      lastRateLimit.resetAt = reset * 1000;
    }
    lastRateLimit.authenticated = hasToken;

    if (typeof rateLimitListener === 'function') {
      rateLimitListener(getRateLimit());
    }
  }

  function formatResetTime(resetMs) {
    if (!resetMs) return 'más tarde';
    try {
      return new Date(resetMs).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'más tarde';
    }
  }

  function parseNextPage(linkHeader) {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="next"/i);
    return match ? Number(match[1]) : null;
  }

  /**
   * Executes a cached GitHub GET request with ETag conditional validation
   * and automatic fallback to stale cache on 403 rate limits or offline errors.
   */
  async function request(path, { cacheKey, ttlMs, allowStaleOnFail = true, trackRateLimit = true } = {}) {
    const cache = root.cache;
    const cached = cacheKey ? cache.get(cacheKey) : { hit: false };

    if (cached.hit && cached.fresh) {
      return {
        data: cached.data,
        headers: {},
        fromCache: true,
        stale: false,
        notModified: false
      };
    }

    const token = cache.getToken();
    const headers = {
      Accept: 'application/vnd.github+json'
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (cached.hit && cached.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    try {
      const res = await fetch(BASE + path, { headers });
      if (trackRateLimit) {
        readRateHeaders(res, Boolean(token));
      }

      if (res.status === 304 && cached.hit) {
        cache.touch(cacheKey, ttlMs);
        return {
          data: cached.data,
          headers: { link: res.headers.get('Link') || '' },
          fromCache: true,
          stale: false,
          notModified: true
        };
      }

      if (res.status === 404) {
        const err = new Error('No existe ese usuario o recurso en GitHub.');
        err.status = 404;
        throw err;
      }

      if (res.status === 401) {
        const err = new Error('Token personal (PAT) inválido o expirado (401). Revisalo en el panel de API.');
        err.status = 401;
        throw err;
      }

      if (res.status === 403) {
        if (allowStaleOnFail && cached.hit) {
          return {
            data: cached.data,
            headers: {},
            fromCache: true,
            stale: true,
            staleReason: 'Límite horario alcanzado; mostrando copia guardada en caché.'
          };
        }
        const resetLabel = formatResetTime(lastRateLimit.resetAt);
        const msg = !trackRateLimit
          ? 'Límite temporal de búsquedas de GitHub alcanzado (10 consultas/min sin token). Probá en un momento o buscá un usuario arriba.'
          : token
            ? `Límite de API excedido con tu token. Se reinicia a las ${resetLabel}.`
            : `Límite de GitHub alcanzado (60 consultas/hora sin token). Se reinicia aprox. a las ${resetLabel} o podés configurar un PAT opcional.`;
        const err = new Error(msg);
        err.status = 403;
        throw err;
      }

      if (!res.ok) {
        const err = new Error(`Error ${res.status} al consultar GitHub.`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const etag = res.headers.get('ETag');
      const link = res.headers.get('Link') || '';
      if (cacheKey) {
        cache.set(cacheKey, data, etag, ttlMs);
      }

      return {
        data,
        headers: { link },
        fromCache: false,
        stale: false,
        notModified: false
      };
    } catch (err) {
      if (!err.status && allowStaleOnFail && cached.hit) {
        return {
          data: cached.data,
          headers: {},
          fromCache: true,
          stale: true,
          staleReason: 'Sin conexión estable con GitHub; mostrando copia local en caché.'
        };
      }
      throw err;
    }
  }

  async function fetchUser(username) {
    const clean = encodeURIComponent(username.trim());
    return request(`/users/${clean}`, {
      cacheKey: `user:${username.trim().toLowerCase()}`
    });
  }

  async function fetchReposPage(username, page = 1) {
    const clean = encodeURIComponent(username.trim());
    const res = await request(`/users/${clean}/repos?per_page=100&sort=updated&page=${page}`, {
      cacheKey: `repos:${username.trim().toLowerCase()}:p${page}`
    });
    const nextPage = parseNextPage(res.headers.link) || (Array.isArray(res.data) && res.data.length === 100 ? page + 1 : null);
    return {
      repos: Array.isArray(res.data) ? res.data : [],
      nextPage,
      stale: res.stale,
      staleReason: res.staleReason
    };
  }

  /**
   * Loads up to `maxPages` pages (100 repos/page) automatically and indicates
   * whether additional pages exist so large accounts can paginate on demand.
   */
  async function fetchRepos(username, startPage = 1, maxPages = 3) {
    const all = [];
    let page = startPage;
    let count = 0;
    let nextPage = null;
    let stale = false;
    let staleReason = '';

    while (page && count < maxPages) {
      const pageRes = await fetchReposPage(username, page);
      all.push(...pageRes.repos);
      if (pageRes.stale) {
        stale = true;
        staleReason = pageRes.staleReason || '';
      }
      nextPage = pageRes.nextPage;
      if (!nextPage || pageRes.repos.length < 100) {
        nextPage = null;
        break;
      }
      page = nextPage;
      count += 1;
    }

    return {
      repos: all,
      hasMore: Boolean(nextPage),
      nextPage,
      stale,
      staleReason
    };
  }

  function formatUtcDate(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  /** Builds a GitHub repository search query for trending windows or all-time top repos. */
  function buildTrendingQuery(range = 'week', nowMs = Date.now()) {
    if (range === 'all') {
      return 'stars:>50000';
    }
    const days = range === 'month' ? 30 : 7;
    const sinceMs = nowMs - days * 24 * 60 * 60 * 1000;
    return `created:>=${formatUtcDate(sinceMs)}`;
  }

  /**
   * Fetches popular repositories for the given time window (`week`, `month`, `all`)
   * with 30-minute ETag cache and automatic fallback if the weekly query returns empty.
   */
  async function fetchTrendingRepos({ range = 'week', perPage = 30 } = {}) {
    const validRange = ['week', 'month', 'all'].includes(range) ? range : 'week';
    const q = buildTrendingQuery(validRange);
    const cacheKey = `trending:${validRange}:${q}:p${perPage}`;

    const res = await request(
      `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}`,
      {
        cacheKey,
        ttlMs: 30 * 60 * 1000,
        trackRateLimit: false
      }
    );

    let items = res.data && Array.isArray(res.data.items) ? res.data.items : [];
    let fallbackNotice = '';
    let stale = Boolean(res.stale);
    let staleReason = res.staleReason || '';

    if (items.length === 0 && validRange !== 'all') {
      const fbQuery = 'stars:>5000';
      const fbRes = await request(
        `/search/repositories?q=${encodeURIComponent(fbQuery)}&sort=updated&order=desc&per_page=${perPage}`,
        {
          cacheKey: `trending:fallback:stars5k:p${perPage}`,
          ttlMs: 30 * 60 * 1000,
          trackRateLimit: false
        }
      );
      items = fbRes.data && Array.isArray(fbRes.data.items) ? fbRes.data.items : [];
      fallbackNotice = 'No hubo resultados recientes para la fecha local del navegador; mostrando repositorios destacados con actividad reciente.';
      if (fbRes.stale) {
        stale = true;
        staleReason = fbRes.staleReason || staleReason;
      }
    }

    return {
      range: validRange,
      items,
      fallbackNotice,
      stale,
      staleReason
    };
  }

  /**
   * Queries GitHub Search for top repositories matching a category, language
   * or stack query without altering the core 60/hour rate limit counter.
   */
  async function fetchCategoryRepos(query, cacheTag = 'cat', perPage = 18) {
    const cleanQ = String(query || '').trim() || 'stars:>10000';
    const res = await request(
      `/search/repositories?q=${encodeURIComponent(cleanQ)}&sort=stars&order=desc&per_page=${perPage}`,
      {
        cacheKey: `explore:${cacheTag}:${cleanQ}:p${perPage}`,
        ttlMs: 30 * 60 * 1000,
        trackRateLimit: false
      }
    );
    return {
      items: res.data && Array.isArray(res.data.items) ? res.data.items : [],
      stale: Boolean(res.stale),
      staleReason: res.staleReason || ''
    };
  }

  /**
   * Collects an unbiased recent sample (sorted by updated, NOT stars) across all
   * public repositories published in the last N days along with GitHub's global total_count.
   */
  async function fetchRecentPublishedRepos({ days = 7, pages = 2, perPage = 100 } = {}) {
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const q = `created:>=${formatUtcDate(sinceMs)}`;
    const seen = new Set();
    const items = [];
    let totalCount = 0;
    let stale = false;
    let staleReason = '';

    for (let page = 1; page <= pages; page += 1) {
      try {
        const res = await request(
          `/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${perPage}&page=${page}`,
          {
            cacheKey: `recent:${days}d:${q}:p${perPage}:pg${page}`,
            ttlMs: 30 * 60 * 1000,
            trackRateLimit: false
          }
        );

        const data = res.data || {};
        if (page === 1 && typeof data.total_count === 'number') {
          totalCount = data.total_count;
        }
        if (res.stale) {
          stale = true;
          staleReason = res.staleReason || staleReason;
        }

        const pageItems = Array.isArray(data.items) ? data.items : [];
        pageItems.forEach((repo) => {
          const key = repo.id || repo.full_name || repo.name;
          if (!seen.has(key)) {
            seen.add(key);
            items.push(repo);
          }
        });

        if (pageItems.length < perPage) break;
      } catch (err) {
        if (page === 1) throw err;
        break;
      }
    }

    return {
      days,
      items,
      totalCount: totalCount || items.length,
      empty: items.length === 0,
      stale,
      staleReason
    };
  }

  async function fetchUserEvents(username) {
    const clean = encodeURIComponent(username.trim());
    try {
      const res = await request(`/users/${clean}/events/public?per_page=100`, {
        cacheKey: `events:${username.trim().toLowerCase()}`,
        ttlMs: 10 * 60 * 1000
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      if (err.status === 404) return [];
      return [];
    }
  }

  async function fetchRepoLanguages(owner, repo) {
    const key = `langs:${owner.toLowerCase()}/${repo.toLowerCase()}`;
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
    const res = await request(path, {
      cacheKey: key,
      ttlMs: 30 * 60 * 1000
    });
    return res.data || {};
  }

  async function fetchRepoCommits(owner, repo) {
    const key = `commits:${owner.toLowerCase()}/${repo.toLowerCase()}`;
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=8`;
    try {
      const res = await request(path, {
        cacheKey: key,
        ttlMs: 10 * 60 * 1000
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  function decodeBase64Utf8(b64) {
    if (!b64) return '';
    const cleaned = String(b64).replace(/\s+/g, '');
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(cleaned, 'base64').toString('utf8');
    }
    if (typeof atob === 'function') {
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      if (typeof TextDecoder === 'function') {
        return new TextDecoder('utf-8').decode(bytes);
      }
      return bin;
    }
    return '';
  }

  async function fetchRepoReadme(owner, repoName) {
    if (!owner || !repoName) return null;
    const key = `readme:${owner.toLowerCase()}/${repoName.toLowerCase()}`;
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/readme`;
    try {
      const res = await request(path, {
        cacheKey: key,
        ttlMs: 30 * 60 * 1000
      });
      const data = res.data;
      if (!data || typeof data.content !== 'string') return null;
      const markdown = data.encoding === 'base64'
        ? decodeBase64Utf8(data.content)
        : String(data.content);
      return {
        name: data.name || 'README.md',
        markdown,
        htmlUrl: data.html_url || ''
      };
    } catch {
      return null;
    }
  }

  async function fetchOrgMembers(org) {
    const clean = encodeURIComponent(org.trim());
    try {
      const res = await request(`/orgs/${clean}/public_members?per_page=10`, {
        cacheKey: `orgmembers:${org.trim().toLowerCase()}`,
        ttlMs: 30 * 60 * 1000
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Fetches the full 365-day contribution calendar via GitHub GraphQL API.
   * Requires an active Personal Access Token; returns null when unavailable.
   */
  async function fetchGraphQLContributions(username) {
    const token = root.cache.getToken();
    if (!token) return null;

    const clean = String(username || '').trim();
    const cacheKey = `gql-cal:${clean.toLowerCase()}`;
    const cached = root.cache.get(cacheKey);
    if (cached.hit && cached.fresh) {
      return cached.data;
    }

    const query = `
      query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch(BASE + '/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query, variables: { login: clean } })
      });
      readRateHeaders(res, true);
      if (!res.ok) return null;

      const payload = await res.json();
      const cal =
        payload &&
        payload.data &&
        payload.data.user &&
        payload.data.user.contributionsCollection &&
        payload.data.user.contributionsCollection.contributionCalendar;

      if (!cal || !Array.isArray(cal.weeks)) return null;
      root.cache.set(cacheKey, cal, null, 15 * 60 * 1000);
      return cal;
    } catch {
      return null;
    }
  }

  /**
   * Fetches exact language bytes for unanalyzed repositories using bounded
   * concurrency, preserving any previously collected bytesMap entries.
   */
  async function fetchBatchLanguages(owner, repos, { existingMap = {}, limit = 12, concurrency = 4, onProgress } = {}) {
    const bytesMap = { ...existingMap };
    const targets = repos.filter((r) => !bytesMap[r.name]).slice(0, limit);
    if (targets.length === 0) {
      return {
        bytesMap,
        analyzedCount: Object.keys(bytesMap).length,
        targetCount: 0,
        rateLimited: false
      };
    }

    let completed = 0;
    let cursor = 0;
    let rateLimited = false;

    async function worker() {
      while (cursor < targets.length && !rateLimited) {
        const index = cursor;
        cursor += 1;
        const r = targets[index];
        try {
          const langs = await fetchRepoLanguages(owner, r.name);
          bytesMap[r.name] = langs;
        } catch (err) {
          if (err.status === 403) {
            rateLimited = true;
          }
        } finally {
          completed += 1;
          if (typeof onProgress === 'function') {
            onProgress(completed, targets.length);
          }
        }
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, targets.length); i += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);

    return {
      bytesMap,
      analyzedCount: Object.keys(bytesMap).length,
      targetCount: targets.length,
      rateLimited
    };
  }

  async function refreshRateLimit() {
    const token = root.cache.getToken();
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch(BASE + '/rate_limit', { headers });
      readRateHeaders(res, Boolean(token));
      if (res.ok) {
        const payload = await res.json();
        const core = payload && payload.resources && payload.resources.core;
        if (core) {
          lastRateLimit = {
            limit: core.limit,
            remaining: core.remaining,
            resetAt: core.reset * 1000,
            authenticated: Boolean(token)
          };
          if (typeof rateLimitListener === 'function') {
            rateLimitListener(getRateLimit());
          }
        }
      }
      return getRateLimit();
    } catch {
      return getRateLimit();
    }
  }

  root.api = {
    setRateLimitListener,
    getRateLimit,
    formatResetTime,
    fetchUser,
    fetchRepos,
    fetchReposPage,
    fetchUserEvents,
    fetchRepoLanguages,
    fetchRepoCommits,
    fetchRepoReadme,
    fetchOrgMembers,
    fetchGraphQLContributions,
    fetchBatchLanguages,
    buildTrendingQuery,
    fetchTrendingRepos,
    fetchRecentPublishedRepos,
    fetchCategoryRepos,
    refreshRateLimit
  };
})();
