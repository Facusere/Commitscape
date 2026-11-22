(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const FALLBACK_COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#c084fc', '#fb923c'];

  const LINGUIST_COLORS = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'Python': '#3572A5',
    'Rust': '#dea584',
    'Go': '#00ADD8',
    'C': '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    'Java': '#b07219',
    'Kotlin': '#A97BFF',
    'Swift': '#F05138',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'SCSS': '#c6538c',
    'Sass': '#a53b70',
    'Less': '#1d365d',
    'Vue': '#41b883',
    'Svelte': '#ff3e00',
    'Astro': '#ff5a03',
    'PHP': '#4F5D95',
    'Ruby': '#701516',
    'Dart': '#00B4AB',
    'Flutter': '#02569B',
    'Shell': '#89e051',
    'Bash': '#89e051',
    'PowerShell': '#012456',
    'Batchfile': '#C1F12E',
    'SQL': '#e38c00',
    'PLpgSQL': '#336790',
    'TSQL': '#e38c00',
    'Jupyter Notebook': '#DA5B0B',
    'R': '#198CE7',
    'Julia': '#a270ba',
    'Lua': '#000080',
    'Elixir': '#6e4a7e',
    'Erlang': '#B83998',
    'Haskell': '#5e5086',
    'Scala': '#c22d40',
    'Clojure': '#db5855',
    'OCaml': '#ef7a08',
    'F#': '#b845fc',
    'Zig': '#ec915c',
    'Nim': '#ffc200',
    'Crystal': '#000100',
    'Solidity': '#AA6746',
    'Move': '#4a137a',
    'Cairo': '#ff4a4a',
    'Dockerfile': '#384d54',
    'Makefile': '#427819',
    'CMake': '#DA3434',
    'Nix': '#7e7eff',
    'Terraform': '#5c4ee5',
    'HCL': '#844FBA',
    'YAML': '#cb171e',
    'JSON': '#292929',
    'Markdown': '#083fa1',
    'MDX': '#fcb32c',
    'TeX': '#3D6117',
    'Objective-C': '#438eff',
    'Objective-C++': '#6866fb',
    'Assembly': '#6E4C13',
    'WebAssembly': '#04133b',
    'GLSL': '#5686a5',
    'HLSL': '#aace60',
    'WGSL': '#1a5e9a',
    'ShaderLab': '#222c37',
    'Processing': '#0096D8',
    'Perl': '#0298c3',
    'Groovy': '#4298b8',
    'Racket': '#3c5caa',
    'Scheme': '#1e4aec',
    'V': '#4f87c4',
    'Vala': '#a56de2',
    'GraphQL': '#e10098',
    'Prisma': '#2D3748',
    'Twig': '#c1d026',
    'Handlebars': '#f7931e',
    'EJS': '#a91e50',
    'Pug': '#a86454',
    'CoffeeScript': '#244776'
  };

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function escAttr(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Returns official GitHub Linguist hex color or a deterministic neon fallback. */
  function getLangColor(language, index = 0) {
    if (!language) return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    if (LINGUIST_COLORS[language]) return LINGUIST_COLORS[language];
    return FALLBACK_COLORS[(hashString(language) + index) % FALLBACK_COLORS.length];
  }

  function buildMonogramSvg(label, color) {
    const rawLower = String(label || '').trim().toLowerCase();
    const mapped = rawLower === 'assembly' ? 'ASM' : (rawLower === 'makefile' ? 'MK' : null);
    const clean = mapped || String(label || '')
      .replace(/[^A-Za-z0-9+#]/g, '')
      .slice(0, 3)
      .toUpperCase();
    if (!clean) {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="${escAttr(color)}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/></svg>`;
    }
    const fontSize = clean.length >= 3 ? '10.5' : (clean.length === 2 ? '13.5' : '16.5');
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="16.8" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="${fontSize}" fill="${escAttr(color)}" stroke="rgba(4,9,15,0.68)" stroke-width="1.2" paint-order="stroke">${escAttr(clean)}</text></svg>`;
  }

  function getLangVectorSvg(language, color) {
    const rawKey = String(language || '').trim().toLowerCase();
    const key = rawKey.replace(/^lang:/, '');

    // Technology Ecosystem categories & stacks
    if (key === 'cat:ai' || key === 'ia & agentes') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#c084fc" d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><circle cx="18.2" cy="18" r="2.2" fill="#e9d5ff"/><circle cx="5.8" cy="17.8" r="1.6" fill="#a855f7"/><path stroke="#c084fc" stroke-width="1.3" d="M12 17.5l6.2.5M12 17.5l-6.2.3"/></svg>';
    }
    if (key === 'cat:web' || key === 'web & full-stack') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.8" fill="none" stroke="#38bdf8" stroke-width="1.9"/><ellipse cx="12" cy="12" rx="4.2" ry="8.8" fill="none" stroke="#7dd3fc" stroke-width="1.5"/><path stroke="#38bdf8" stroke-width="1.5" d="M3.6 9.2h16.8M3.6 14.8h16.8"/></svg>';
    }
    if (key === 'cat:systems' || key === 'sistemas & cli') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4.5,7 10.5,12 4.5,17" fill="none" stroke="#fb923c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><line x1="11.5" y1="17" x2="19.5" y2="17" stroke="#fed7aa" stroke-width="2.6" stroke-linecap="round"/></svg>';
    }
    if (key === 'cat:cloud' || key === 'cloud & devops') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4ade80" d="M7.2 18.5h10.2a4.1 4.1 0 0 0 .5-8.1A5.6 5.6 0 0 0 7 9.1a4.7 4.7 0 0 0 .2 9.4z"/><path fill="#bbf7d0" opacity="0.45" d="M9.5 14.2a2.5 2.5 0 0 1 5 0h2a3 3 0 0 0-5.8-1.1z"/></svg>';
    }
    if (key === 'cat:data' || key === 'datos & gpu') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="#facc15" fill-opacity="0.24" stroke="#facc15" stroke-width="1.9"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#fde047"/><path stroke="#facc15" stroke-width="1.8" stroke-linecap="round" d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/></svg>';
    }
    if (key === 'cat:mobile' || key === 'mobile & apps') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.8" y="2.8" width="10.4" height="18.4" rx="2.4" fill="#2dd4bf" fill-opacity="0.2" stroke="#2dd4bf" stroke-width="1.9"/><line x1="10" y1="5.6" x2="14" y2="5.6" stroke="#99f6e4" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="18.2" r="1.2" fill="#99f6e4"/></svg>';
    }
    if (key === 'stack:llm' || key === 'llms & mcp') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6.5" y1="7" x2="17.5" y2="7" stroke="#c084fc" stroke-width="1.8"/><line x1="6.5" y1="7" x2="12" y2="17.5" stroke="#c084fc" stroke-width="1.8"/><line x1="17.5" y1="7" x2="12" y2="17.5" stroke="#c084fc" stroke-width="1.8"/><circle cx="6.5" cy="7" r="2.7" fill="#e9d5ff"/><circle cx="17.5" cy="7" r="2.7" fill="#c084fc"/><circle cx="12" cy="17.5" r="3" fill="#a855f7" stroke="#f3e8ff" stroke-width="1"/></svg>';
    }
    if (key === 'stack:react' || key === 'react & next.js') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.1" fill="#38bdf8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" fill="none" stroke="#38bdf8" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" fill="none" stroke="#38bdf8" stroke-width="1.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" fill="none" stroke="#38bdf8" stroke-width="1.5" transform="rotate(120 12 12)"/></svg>';
    }
    if (key === 'stack:cli' || key === 'cli & wasm') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2.5 20,7.2 20,16.8 12,21.5 4,16.8 4,7.2" fill="#fb923c" fill-opacity="0.22" stroke="#fb923c" stroke-width="1.8"/><polyline points="8.2,9.2 11.4,12 8.2,14.8" fill="none" stroke="#fed7aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12.5" y1="14.8" x2="16.2" y2="14.8" stroke="#fed7aa" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    if (key === 'stack:docker' || key === 'docker & k8s') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="9" width="3" height="3" fill="#4ade80"/><rect x="9" y="9" width="3" height="3" fill="#4ade80"/><rect x="13" y="9" width="3" height="3" fill="#4ade80"/><rect x="9" y="5.2" width="3" height="3" fill="#4ade80"/><path fill="#22c55e" d="M3 13.5h15.5c2 0 3.2-1.2 3.5-2.6-.8 0-1.6.3-2 .8-.1-.9-.5-1.7-1.1-2.2-.6.8-.9 1.8-.6 2.8H3c0 4 3 7.2 7.8 7.2 4.6 0 8.5-2.6 9.8-6z"/></svg>';
    }
    if (key === 'stack:pg' || key === 'postgresql & vector') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6.2" rx="7.5" ry="3" fill="#facc15"/><path fill="#ca8a04" stroke="#fef08a" stroke-width="0.9" d="M4.5 6.2v11.6c0 1.65 3.36 3 7.5 3s7.5-1.35 7.5-3V6.2"/><ellipse cx="12" cy="6.2" rx="7.5" ry="3" fill="#fde047" opacity="0.9"/><path fill="none" stroke="rgba(255,255,255,0.48)" stroke-width="1" d="M4.5 11.8c0 1.65 3.36 3 7.5 3s7.5-1.35 7.5-3"/></svg>';
    }
    if (key === 'stack:mobile' || key === 'flutter & native') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="14,3 5,12 8,15 20,3" fill="#5eead4"/><polygon points="14,11 9,16 14,21 20,21 14.5,15.5 20,11" fill="#0d9488"/></svg>';
    }

    if (key === 'python') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#3776AB" d="M11.9 2C7.8 2 8.1 3.8 8.1 3.8V6h4v.8H5.8S2 6.4 2 10.6c0 4.2 3.3 4.1 3.3 4.1h1.9v-2s-.1-3.3 3.2-3.3h4s2.7 0 2.7-2.6V4.4S17.5 2 11.9 2zm-1.6 1.8a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z"/><path fill="#FFD43B" d="M12.1 22c4.1 0 3.8-1.8 3.8-1.8V18h-4v-.8h6.3s3.8.4 3.8-3.8c0-4.2-3.3-4.1-3.3-4.1h-1.9v2s.1 3.3-3.2 3.3h-4s-2.7 0-2.7 2.6v2.4S6.5 22 12.1 22zm1.6-1.8a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8z"/></svg>';
    }
    if (key === 'typescript') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="14.5" fill="#3178C6" stroke="#e0f2fe" stroke-width="0.9" paint-order="stroke">TS</text></svg>';
    }
    if (key === 'javascript') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="15" fill="#F7DF1E" stroke="rgba(4,9,15,0.65)" stroke-width="1.2" paint-order="stroke">JS</text></svg>';
    }
    if (key === 'rust') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="#DEA584" stroke-width="2.4" stroke-dasharray="2.5 1.6"/><circle cx="12" cy="12" r="5.2" fill="rgba(15,23,42,0.55)" stroke="#DEA584" stroke-width="1.4"/><text x="12" y="15.2" text-anchor="middle" font-family="Georgia,serif" font-weight="800" font-size="9.8" fill="#f8fafc">R</text></svg>';
    }
    if (key === 'go') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.2" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-style="italic" font-size="14.5" fill="#00ADD8" stroke="rgba(4,9,15,0.6)" stroke-width="1" paint-order="stroke">GO</text></svg>';
    }
    if (key === 'c' || key === 'c++' || key === 'c#') {
      const fill = key === 'c#' ? '#239120' : (key === 'c++' ? '#00599C' : '#3B5998');
      const lbl = key === 'c#' ? 'C#' : (key === 'c++' ? 'C++' : 'C');
      const fs = lbl.length >= 3 ? '8.5' : (lbl.length === 2 ? '10' : '12');
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="${fill}" stroke="rgba(255,255,255,0.34)" stroke-width="1"/><text x="12" y="15.6" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="800" font-size="${fs}" fill="#ffffff">${lbl}</text></svg>`;
    }
    if (key === 'java') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#38bdf8" stroke-width="1.7" stroke-linecap="round" d="M10.5 3.5c1.5 1.3-1.2 2.4.3 3.7M14.2 3c1.6 1.4-1.3 2.6.2 4"/><path fill="#EA8C1E" d="M6 10h10.5v4.5A4.5 4.5 0 0 1 12 19h-1.5A4.5 4.5 0 0 1 6 14.5V10z"/><path fill="none" stroke="#EA8C1E" stroke-width="1.8" d="M16.5 11.2h1.6a2 2 0 0 1 0 4h-1.6"/><path stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" d="M5 20.8h12.5"/></svg>';
    }
    if (key === 'kotlin') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="cs-kt" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#E44857"/><stop offset="0.5" stop-color="#C711E1"/><stop offset="1" stop-color="#7F52FF"/></linearGradient></defs><polygon points="3,3 21,3 12,12 21,21 3,21" fill="url(#cs-kt)"/></svg>';
    }
    if (key === 'swift') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F05138" d="M19.8 14.8c1.6-3.4-.3-7.6-4.1-9.8 1.6 2.6 1.3 5.2-.7 7.1-2.8-1.8-6.2-4.8-8.1-7.1 1.3 2.9 3.7 5.8 6.3 7.8-2.8-.8-5.5-2.3-7.6-4.5 1.2 2.9 3.9 5.9 7.4 7.4-2 .9-4.5 1.1-6.7.1 3 2.7 7.5 3.7 11.4 2.1 1.3-.5 2.5.9 3.5 1.6-.2-1.6-.6-3.4-1.4-4.7z"/></svg>';
    }
    if (key === 'html') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,3 20,3 18.5,18.5 12,21 5.5,18.5" fill="#E34F26"/><text x="12" y="15.8" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="11.5" fill="#ffffff">5</text></svg>';
    }
    if (key === 'css' || key === 'scss' || key === 'sass' || key === 'less') {
      const fill = key === 'scss' || key === 'sass' ? '#CF649A' : '#1572B6';
      const lbl = key === 'css' ? '3' : key.toUpperCase().slice(0, 3);
      const fs = lbl === '3' ? '11.5' : '7.8';
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,3 20,3 18.5,18.5 12,21 5.5,18.5" fill="${fill}"/><text x="12" y="15.2" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="${fs}" fill="#ffffff">${lbl}</text></svg>`;
    }
    if (key === 'vue') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="2,4 12,21 22,4 18,4 12,14.5 6,4" fill="#41B883"/><polygon points="6,4 12,14.5 18,4 14.8,4 12,9 9.2,4" fill="#35495E"/></svg>';
    }
    if (key === 'svelte') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FF3E00" d="M19.2 7.5a5 5 0 0 0-6.8-2L7.3 8.7a4.6 4.6 0 0 0-1.6 6.2c.4.6.9 1.1 1.5 1.4a4.5 4.5 0 0 0-.4 2.1 5 5 0 0 0 7.7 3.8l5.1-3.2a4.6 4.6 0 0 0 1.6-6.2c-.4-.6-.9-1.1-1.5-1.4a4.5 4.5 0 0 0 .5-2.9z"/><path fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M14.7 8.4l-4.6 2.9a1.9 1.9 0 0 0-.6 2.6c.4.6 1.2.9 1.9.7l2.2-.5a1.9 1.9 0 0 1 1.8.8 1.9 1.9 0 0 1-.6 2.6l-4.6 2.9"/></svg>';
    }
    if (key === 'astro') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f8fafc" d="M8.8 3h6.4l4.5 13.5-3.2-1.8-1.4-4.2H8.9l-1.4 4.2-3.2 1.8z"/><path fill="#FF5D01" d="M9.8 16.2c1.1 1.2 3.3 1.2 4.4 0 .4 1.8-.8 3.6-2.2 4.8-1.4-1.2-2.6-3-2.2-4.8z"/></svg>';
    }
    if (key === 'php') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="10.5" ry="6.8" fill="#777BB4" stroke="rgba(255,255,255,0.35)" stroke-width="1"/><text x="12" y="15" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-style="italic" font-size="8.6" fill="#ffffff">PHP</text></svg>';
    }
    if (key === 'ruby') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 18,4 21,9.5 12,20.5 3,9.5" fill="#CC342D" stroke="#fca5a5" stroke-width="0.9"/><polyline points="3,9.5 21,9.5" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1"/><polyline points="8.5,4 6.5,9.5 12,20.5 17.5,9.5 15.5,4" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1"/></svg>';
    }
    if (key === 'dart' || key === 'flutter') {
      const c1 = key === 'flutter' ? '#54C5F8' : '#00B4AB';
      const c2 = key === 'flutter' ? '#01579B' : '#0175C2';
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="14,3 5,12 8,15 20,3" fill="${c1}"/><polygon points="14,11 9,16 14,21 20,21 14.5,15.5 20,11" fill="${c2}"/></svg>`;
    }
    if (key === 'shell' || key === 'bash' || key === 'powershell' || key === 'batchfile') {
      const stroke = key === 'powershell' ? '#60a5fa' : '#4ADE80';
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4.5,7 10.5,12 4.5,17" fill="none" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="11.5" y1="17" x2="19.5" y2="17" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round"/></svg>`;
    }
    if (key === 'sql' || key === 'plpgsql' || key === 'tsql') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6.2" rx="7.5" ry="3" fill="#E38C00"/><path fill="#c27400" stroke="#fcd34d" stroke-width="0.9" d="M4.5 6.2v11.6c0 1.65 3.36 3 7.5 3s7.5-1.35 7.5-3V6.2"/><ellipse cx="12" cy="6.2" rx="7.5" ry="3" fill="#fbbf24" opacity="0.85"/><path fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1" d="M4.5 11.8c0 1.65 3.36 3 7.5 3s7.5-1.35 7.5-3"/></svg>';
    }
    if (key === 'jupyter notebook') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="8.5" ry="5" fill="none" stroke="#F37626" stroke-width="2.2" transform="rotate(-18 12 12)"/><circle cx="6.2" cy="5.5" r="1.8" fill="#9CA3AF"/><circle cx="17.8" cy="5.5" r="1.4" fill="#6B7280"/><circle cx="7" cy="18.8" r="1.5" fill="#9CA3AF"/></svg>';
    }
    if (key === 'dockerfile') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="9" width="3" height="3" fill="#38bdf8"/><rect x="9" y="9" width="3" height="3" fill="#38bdf8"/><rect x="13" y="9" width="3" height="3" fill="#38bdf8"/><rect x="9" y="5.2" width="3" height="3" fill="#38bdf8"/><path fill="#0284c7" d="M3 13.5h15.5c2 0 3.2-1.2 3.5-2.6-.8 0-1.6.3-2 .8-.1-.9-.5-1.7-1.1-2.2-.6.8-.9 1.8-.6 2.8H3c0 4 3 7.2 7.8 7.2 4.6 0 8.5-2.6 9.8-6z"/></svg>';
    }
    if (key === 'markdown' || key === 'mdx') {
      const accent = key === 'mdx' ? '#FCB32C' : '#38bdf8';
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${accent}" d="M3 17V7h2.6l2.9 3.6L11.4 7H14v10h-2.5v-5.3L8.5 15.2 5.5 11.7V17zm15.2 0l-3.4-4h2V7h2.8v6h2z"/></svg>`;
    }
    if (key === 'lua') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11.5" cy="12.5" r="8" fill="#1D4ED8"/><circle cx="14.2" cy="9.8" r="2.2" fill="#ffffff"/><circle cx="19" cy="5.2" r="2" fill="#60A5FA"/></svg>';
    }
    if (key === 'elixir') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#9333EA" d="M12.2 2.5C8.5 7 6 11.1 6 14.8a6 6 0 0 0 12 0c0-3.2-2.2-7-5.8-12.3z"/><path fill="rgba(255,255,255,0.28)" d="M11 6.5c-1.8 3-2.9 5.5-2.9 7.8a3.9 3.9 0 0 0 3.4 3.9c-1.2-2.3-1.2-6-.5-11.7z"/></svg>';
    }
    if (key === 'haskell') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3,6 8,12 3,18" fill="none" stroke="#8F4E8B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8.5,6 15.5,18" fill="none" stroke="#A78BFA" stroke-width="2.4" stroke-linecap="round"/><polyline points="12,12 8.5,18" fill="none" stroke="#A78BFA" stroke-width="2.4" stroke-linecap="round"/><path stroke="#C084FC" stroke-width="2.1" stroke-linecap="round" d="M15.5 10.5H21M17 14h4"/></svg>';
    }
    if (key === 'zig') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,5 19.5,5 10.5,15.5 20,15.5 20,19 4,19 13,8.5 4,8.5" fill="#F7A41D"/></svg>';
    }
    if (key === 'r') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="11.5" cy="11.5" rx="8.5" ry="6" fill="none" stroke="#9CA3AF" stroke-width="2.2"/><text x="13" y="16.8" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="13.5" fill="#276DC3">R</text></svg>';
    }
    if (key === 'graphql') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,3.5 19.5,7.8 19.5,16.2 12,20.5 4.5,16.2 4.5,7.8" fill="none" stroke="#E10098" stroke-width="1.5"/><polygon points="12,4 19,16 5,16" fill="none" stroke="#E10098" stroke-width="1.3"/><circle cx="12" cy="3.5" r="1.4" fill="#E10098"/><circle cx="19.5" cy="7.8" r="1.4" fill="#E10098"/><circle cx="19.5" cy="16.2" r="1.4" fill="#E10098"/><circle cx="12" cy="20.5" r="1.4" fill="#E10098"/><circle cx="4.5" cy="16.2" r="1.4" fill="#E10098"/><circle cx="4.5" cy="7.8" r="1.4" fill="#E10098"/></svg>';
    }

    return buildMonogramSvg(language, color);
  }

  /** Returns a standalone data-URI SVG string for canvas Image sprites. */
  function getLangSvgDataUri(language, color = null) {
    const finalColor = color || getLangColor(language, 0);
    const svg = getLangVectorSvg(language, finalColor);
    const xmlSvg = svg.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xmlSvg);
  }

  /** Returns sanitized 3D extruded spinning emblem markup for a programming language. */
  function getLangIconHtml(language, index = 0) {
    const color = getLangColor(language, index);
    const svg = getLangVectorSvg(language, color);
    return `<span class="lang-logo-badge" style="--lang-color:${escAttr(color)}" aria-hidden="true"><span class="logo-3d-rotor"><span class="logo-3d-layer is-front">${svg}</span><span class="logo-3d-layer is-mid">${svg}</span><span class="logo-3d-layer is-back">${svg}</span></span></span>`;
  }

  root.colors = {
    FALLBACK_COLORS,
    LINGUIST_COLORS,
    getLangColor,
    getLangVectorSvg,
    getLangSvgDataUri,
    getLangIconHtml
  };
})();
