(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const HTML_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  /** Escapes untrusted text before inserting into HTML strings. */
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_MAP[ch]);
  }

  /**
   * Validates external URLs and allows only http(s) schemes.
   * Normalizes bare domain strings (without scheme/spaces/colons) to https://.
   */
  function safeUrl(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return '';
    if (/^(javascript|data|vbscript|file):/i.test(text)) return '';

    let candidate = text;
    if (!/^https?:\/\//i.test(candidate)) {
      if (candidate.includes(':') || /\s/.test(candidate)) return '';
      candidate = 'https://' + candidate;
    }

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      return parsed.href;
    } catch {
      return '';
    }
  }

  function formatNumber(n) {
    const num = Number(n) || 0;
    return new Intl.NumberFormat('es-AR').format(num);
  }

  function formatCompact(n) {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(num);
  }

  function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  }

  function timeAgo(iso) {
    if (!iso) return 'sin fecha';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return 'sin fecha';
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'hace un momento';
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days} d`;
    const months = Math.floor(days / 30);
    if (months < 12) return `hace ${months} m`;
    const years = Math.floor(months / 12);
    return `hace ${years} año${years > 1 ? 's' : ''}`;
  }

  function debounce(fn, wait = 180) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  root.utils = {
    esc,
    safeUrl,
    formatNumber,
    formatCompact,
    formatBytes,
    timeAgo,
    debounce
  };
})();
