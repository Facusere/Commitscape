(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const PREFIX = 'commitscape:v1:';
  const CACHE_PREFIX = PREFIX + 'api:';
  const HISTORY_KEY = PREFIX + 'history';
  const TOKEN_SESSION_KEY = PREFIX + 'pat_session';
  const TOKEN_LOCAL_KEY = PREFIX + 'pat_local';
  const THEME_KEY = PREFIX + 'theme';
  const VALID_THEMES = ['midnight', 'emerald', 'synthwave', 'light'];
  const DEFAULT_TTL_MS = 15 * 60 * 1000;

  function safeStorage(kind = 'local') {
    try {
      return kind === 'session' ? window.sessionStorage : window.localStorage;
    } catch {
      return null;
    }
  }

  function pruneOldestCacheEntries(storage) {
    if (!storage) return;
    const entries = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        try {
          const parsed = JSON.parse(storage.getItem(k) || '{}');
          entries.push({ key: k, savedAt: parsed.savedAt || 0 });
        } catch {
          entries.push({ key: k, savedAt: 0 });
        }
      }
    }
    entries.sort((a, b) => a.savedAt - b.savedAt);
    const removeCount = Math.max(1, Math.ceil(entries.length * 0.35));
    for (let i = 0; i < removeCount && i < entries.length; i += 1) {
      storage.removeItem(entries[i].key);
    }
  }

  /** Reads cached API payload; distinguishes fresh hits from stale entries with ETag. */
  function get(key) {
    const storage = safeStorage('local');
    if (!storage) return { hit: false };
    try {
      const raw = storage.getItem(CACHE_PREFIX + key);
      if (!raw) return { hit: false };
      const parsed = JSON.parse(raw);
      const ttl = parsed.ttlMs || DEFAULT_TTL_MS;
      const age = Date.now() - (parsed.savedAt || 0);
      return {
        hit: true,
        fresh: age < ttl,
        data: parsed.data,
        etag: parsed.etag || null,
        savedAt: parsed.savedAt || 0
      };
    } catch {
      return { hit: false };
    }
  }

  function set(key, data, etag = null, ttlMs = DEFAULT_TTL_MS) {
    const storage = safeStorage('local');
    if (!storage) return;
    const payload = JSON.stringify({ data, etag, savedAt: Date.now(), ttlMs });
    try {
      storage.setItem(CACHE_PREFIX + key, payload);
    } catch {
      pruneOldestCacheEntries(storage);
      try {
        storage.setItem(CACHE_PREFIX + key, payload);
      } catch {
        // Ignore storage quota failures so runtime keeps working in memory.
      }
    }
  }

  function touch(key, ttlMs = DEFAULT_TTL_MS) {
    const entry = get(key);
    if (entry.hit) {
      set(key, entry.data, entry.etag, ttlMs);
    }
  }

  function clearApiCache() {
    const storage = safeStorage('local');
    if (!storage) return;
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  }

  function getHistory() {
    const storage = safeStorage('local');
    if (!storage) return [];
    try {
      const list = JSON.parse(storage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(list) ? list.filter((u) => typeof u === 'string' && u.trim()) : [];
    } catch {
      return [];
    }
  }

  function pushHistory(username) {
    const clean = String(username || '').trim();
    if (!clean) return getHistory();
    const storage = safeStorage('local');
    const current = getHistory().filter((u) => u.toLowerCase() !== clean.toLowerCase());
    const next = [clean, ...current].slice(0, 6);
    if (storage) {
      try {
        storage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // noop
      }
    }
    return next;
  }

  function clearHistory() {
    const storage = safeStorage('local');
    if (storage) storage.removeItem(HISTORY_KEY);
  }

  function getToken() {
    const session = safeStorage('session');
    const local = safeStorage('local');
    return (session && session.getItem(TOKEN_SESSION_KEY)) || (local && local.getItem(TOKEN_LOCAL_KEY)) || '';
  }

  function getTokenPersistence() {
    const local = safeStorage('local');
    if (local && local.getItem(TOKEN_LOCAL_KEY)) return 'local';
    const session = safeStorage('session');
    if (session && session.getItem(TOKEN_SESSION_KEY)) return 'session';
    return 'none';
  }

  function setToken(token, persistLocal = false) {
    const clean = String(token || '').trim();
    clearToken();
    if (!clean) return;
    const target = safeStorage(persistLocal ? 'local' : 'session');
    const key = persistLocal ? TOKEN_LOCAL_KEY : TOKEN_SESSION_KEY;
    if (target) target.setItem(key, clean);
  }

  function clearToken() {
    const session = safeStorage('session');
    const local = safeStorage('local');
    if (session) session.removeItem(TOKEN_SESSION_KEY);
    if (local) local.removeItem(TOKEN_LOCAL_KEY);
  }

  function getTheme() {
    const storage = safeStorage('local');
    if (!storage) return 'midnight';
    const val = storage.getItem(THEME_KEY);
    return VALID_THEMES.includes(val) ? val : 'midnight';
  }

  function setTheme(theme) {
    const next = VALID_THEMES.includes(theme) ? theme : 'midnight';
    const storage = safeStorage('local');
    if (storage) {
      try {
        storage.setItem(THEME_KEY, next);
      } catch {
        // noop
      }
    }
    return next;
  }

  root.cache = {
    DEFAULT_TTL_MS,
    VALID_THEMES,
    get,
    set,
    touch,
    clearApiCache,
    getHistory,
    pushHistory,
    clearHistory,
    getToken,
    getTokenPersistence,
    setToken,
    clearToken,
    getTheme,
    setTheme
  };
})();
