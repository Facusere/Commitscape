(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const state = {
    mode: 'home', // 'home' | 'single' | 'compare'
    theme: 'midnight',
    trendingRange: 'week', // 'week' | 'month' | 'all'
    selectedNeuralId: null,
    trendingFilter: null, // null | { id, label, kind, items }
    trendingExplore: null, // null | { id, label, items, stale, staleReason }
    trendingData: null,
    recentPublishedData: null, // null | { items, totalCount, days, empty, stale, staleReason }
    languageMetric: 'repos', // 'repos' | 'bytes'
    languageView: 'orbital', // 'orbital'
    activityRange: '70d', // '70d' | '365d'
    activeLanguage: null,
    filters: {
      query: '',
      includeForks: false,
      includeArchived: true,
      sortBy: 'stars'
    },
    visibleRepoCount: 12,
    currentProfile: null,
    currentReposPagination: {
      hasMore: false,
      nextPage: null
    },
    duel: {
      profileA: null,
      profileB: null
    },
    bytesProgress: null // { done, total } | null
  };

  function readUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        user: (params.get('user') || '').trim(),
        compare: (params.get('compare') || '').trim(),
        mode: params.get('mode') === 'bytes' ? 'bytes' : 'repos',
        lang: (params.get('lang') || '').trim() || null
      };
    } catch {
      return { user: '', compare: '', mode: 'repos', lang: null };
    }
  }

  function syncUrlParams({ user, compare, mode, lang }) {
    try {
      const url = new URL(window.location.href);
      if (user) url.searchParams.set('user', user);
      else url.searchParams.delete('user');

      if (compare) url.searchParams.set('compare', compare);
      else url.searchParams.delete('compare');

      if (mode === 'bytes') url.searchParams.set('mode', 'bytes');
      else url.searchParams.delete('mode');

      if (lang) url.searchParams.set('lang', lang);
      else url.searchParams.delete('lang');

      window.history.replaceState({}, '', url.toString());
    } catch {
      // Safe no-op on restricted file:// histories.
    }
  }

  root.state = state;
  root.url = {
    readUrlParams,
    syncUrlParams
  };
})();
