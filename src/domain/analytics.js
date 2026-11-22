(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const VOXEL_PALETTE = [
    '#142a3d',
    '#0e4d6e',
    '#0284c7',
    '#38bdf8',
    '#4ade80'
  ];

  function toDayKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDayShort(dayKey) {
    const [y, m, d] = dayKey.split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Builds a 70-day (10x7) voxel activity grid combining public GitHub events
   * and recent repository push timestamps.
   */
  function buildActivityMatrix(events, ownRepos) {
    const DAYS = 70;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayBuckets = new Map();
    for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - offset);
      const key = toDayKey(dt);
      dayBuckets.set(key, {
        date: key,
        label: formatDayShort(key),
        commits: 0,
        events: 0,
        repos: new Set()
      });
    }

    (events || []).forEach((ev) => {
      if (!ev || !ev.created_at) return;
      const key = ev.created_at.slice(0, 10);
      const bucket = dayBuckets.get(key);
      if (!bucket) return;

      bucket.events += 1;
      if (ev.repo && ev.repo.name) {
        bucket.repos.add(ev.repo.name.split('/').pop());
      }
      if (ev.type === 'PushEvent') {
        const size = Number(ev.payload && (ev.payload.size || (ev.payload.commits && ev.payload.commits.length))) || 1;
        bucket.commits += size;
      } else {
        bucket.commits += 1;
      }
    });

    // Supplement days with no public events using recent repo push dates.
    (ownRepos || []).forEach((repo) => {
      if (!repo.pushed_at) return;
      const key = repo.pushed_at.slice(0, 10);
      const bucket = dayBuckets.get(key);
      if (bucket && bucket.events === 0) {
        bucket.commits += 1;
        bucket.repos.add(repo.name);
      }
    });

    const rows = Array.from(dayBuckets.values());
    const maxScore = Math.max(1, ...rows.map((r) => r.commits));

    return rows.map((cell) => {
      let level = 0;
      if (cell.commits > 0) {
        const ratio = cell.commits / maxScore;
        if (ratio >= 0.75) level = 4;
        else if (ratio >= 0.45) level = 3;
        else if (ratio >= 0.2) level = 2;
        else level = 1;
      }
      const heightPx = cell.commits === 0 ? 4 : Math.round(12 + (cell.commits / maxScore) * 50);
      return {
        date: cell.date,
        label: cell.label,
        commits: cell.commits,
        events: cell.events,
        repos: Array.from(cell.repos).slice(0, 3),
        level,
        color: VOXEL_PALETTE[level],
        heightPx
      };
    });
  }

  function computeLanguagesByRepo(ownRepos) {
    const counts = {};
    ownRepos.forEach((r) => {
      if (r.language) {
        counts[r.language] = (counts[r.language] || 0) + 1;
      }
    });
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0) || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], idx) => ({
        name,
        value: count,
        pct: (count / total) * 100,
        color: root.colors.getLangColor(name, idx)
      }));
  }

  function computeLanguagesByBytes(bytesMap) {
    const totals = {};
    Object.values(bytesMap || {}).forEach((repoLangs) => {
      Object.entries(repoLangs || {}).forEach(([lang, bytes]) => {
        totals[lang] = (totals[lang] || 0) + Number(bytes || 0);
      });
    });
    const grandTotal = Object.values(totals).reduce((sum, n) => sum + n, 0);
    if (!grandTotal) return [];

    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes], idx) => ({
        name,
        value: bytes,
        pct: (bytes / grandTotal) * 100,
        color: root.colors.getLangColor(name, idx)
      }));
  }

  function resolveTier(value, thresholds) {
    if (value >= thresholds[3]) return 'diamante';
    if (value >= thresholds[2]) return 'oro';
    if (value >= thresholds[1]) return 'plata';
    if (value >= thresholds[0]) return 'bronce';
    return 'locked';
  }

  function computeTrophies(stats) {
    return [
      {
        id: 'stars',
        icon: '★',
        title: 'Arquitecto Estelar',
        tier: resolveTier(stats.totalStars, [10, 100, 1000, 10000]),
        detail: `${root.utils.formatCompact(stats.totalStars)} estrellas en repos propios`
      },
      {
        id: 'polyglot',
        icon: '◈',
        title: 'Políglota del Código',
        tier: resolveTier(stats.languageDiversity, [2, 4, 6, 10]),
        detail: `${stats.languageDiversity} lenguajes activos detectados`
      },
      {
        id: 'veteran',
        icon: '⏳',
        title: 'Veterano Open Source',
        tier: resolveTier(stats.yearsActive, [1, 3, 6, 10]),
        detail: `${stats.yearsActive} años desde su alta (${stats.joinedYear})`
      },
      {
        id: 'builder',
        icon: '▲',
        title: 'Constructor Original',
        tier: resolveTier(stats.ownReposCount, [3, 10, 25, 50]),
        detail: `${stats.ownReposCount} repositorios propios publicados`
      }
    ];
  }

  /**
   * Transforms a GitHub GraphQL contributionCalendar (up to 53 weeks x 7 days)
   * into an extruded annual voxel matrix.
   */
  function buildAnnualActivityMatrix(calendar) {
    if (!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length === 0) {
      return null;
    }
    const weeks = calendar.weeks.slice(-53);
    const flatDays = [];
    weeks.forEach((w) => {
      const days = Array.isArray(w.contributionDays) ? w.contributionDays : [];
      for (let row = 0; row < 7; row += 1) {
        const d = days[row];
        if (d) {
          flatDays.push({
            date: d.date,
            label: formatDayShort(d.date),
            count: Number(d.contributionCount) || 0
          });
        } else {
          flatDays.push({ date: '', label: 'Sin fecha', count: 0 });
        }
      }
    });

    // Reorder into grid rows (7 rows x N weeks) so CSS Grid fills column-by-week cleanly
    const weeksCount = weeks.length;
    const gridOrdered = [];
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < weeksCount; c += 1) {
        gridOrdered.push(flatDays[c * 7 + r] || { date: '', label: 'Sin fecha', count: 0 });
      }
    }

    const maxCount = Math.max(1, ...gridOrdered.map((d) => d.count));
    let activeDays = 0;
    const cells = gridOrdered.map((d) => {
      if (d.count > 0) activeDays += 1;
      let level = 0;
      if (d.count > 0) {
        const ratio = d.count / maxCount;
        if (ratio >= 0.75) level = 4;
        else if (ratio >= 0.45) level = 3;
        else if (ratio >= 0.2) level = 2;
        else level = 1;
      }
      const heightPx = d.count === 0 ? 3 : Math.round(8 + (d.count / maxCount) * 34);
      return {
        ...d,
        level,
        color: VOXEL_PALETTE[level],
        heightPx
      };
    });

    return {
      totalContributions: Number(calendar.totalContributions) || 0,
      activeDays,
      weeksCount,
      cells
    };
  }

  function buildProfileModel(user, repos, events = [], bytesMap = {}, extra = {}) {
    const allRepos = Array.isArray(repos) ? repos : [];
    const ownRepos = allRepos.filter((r) => !r.fork);
    const forkRepos = allRepos.filter((r) => r.fork);

    const totalStars = ownRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const totalForks = ownRepos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
    const joinedYear = user && user.created_at ? Number(user.created_at.slice(0, 4)) : new Date().getFullYear();
    const yearsActive = Math.max(1, new Date().getFullYear() - joinedYear);

    const languagesByRepo = computeLanguagesByRepo(ownRepos);
    const languagesByBytes = computeLanguagesByBytes(bytesMap);
    const languageDiversity = languagesByRepo.length;
    const unanalyzedOwnCount = ownRepos.filter((r) => !bytesMap[r.name]).length;

    const stats = {
      publicRepos: (user && user.public_repos) || allRepos.length,
      loadedRepos: allRepos.length,
      ownReposCount: ownRepos.length,
      forkReposCount: forkRepos.length,
      followers: (user && user.followers) || 0,
      following: (user && user.following) || 0,
      totalStars,
      totalForks,
      avgStars: ownRepos.length ? Math.round((totalStars / ownRepos.length) * 10) / 10 : 0,
      joinedYear,
      yearsActive,
      languageDiversity
    };

    const activityMatrix = buildActivityMatrix(events, ownRepos);
    const activeDays = activityMatrix.filter((d) => d.commits > 0).length;
    const totalRecentActivity = activityMatrix.reduce((sum, d) => sum + d.commits, 0);
    const annualActivity = buildAnnualActivityMatrix(extra.annualCalendar);

    return {
      user,
      isOrg: Boolean(user && user.type === 'Organization'),
      orgMembers: Array.isArray(extra.orgMembers) ? extra.orgMembers : [],
      repos: allRepos,
      ownRepos,
      stats,
      languagesByRepo,
      languagesByBytes,
      bytesMap,
      unanalyzedOwnCount,
      activityMatrix,
      activeDays,
      totalRecentActivity,
      annualActivity,
      trophies: computeTrophies(stats)
    };
  }

  /** Computes side-by-side comparison metrics and Jaccard language affinity. */
  function buildDuelModel(profileA, profileB) {
    const setA = new Set(profileA.languagesByRepo.map((l) => l.name));
    const setB = new Set(profileB.languagesByRepo.map((l) => l.name));
    const shared = Array.from(setA).filter((l) => setB.has(l));
    const onlyA = Array.from(setA).filter((l) => !setB.has(l));
    const onlyB = Array.from(setB).filter((l) => !setA.has(l));
    const unionSize = new Set([...setA, ...setB]).size;
    const affinityPct = unionSize ? Math.round((shared.length / unionSize) * 100) : 0;

    const metrics = [
      { key: 'ownRepos', label: 'Repos propios', a: profileA.stats.ownReposCount, b: profileB.stats.ownReposCount },
      { key: 'stars', label: 'Estrellas ★', a: profileA.stats.totalStars, b: profileB.stats.totalStars },
      { key: 'forks', label: 'Forks ⑂', a: profileA.stats.totalForks, b: profileB.stats.totalForks },
      { key: 'followers', label: 'Seguidores', a: profileA.stats.followers, b: profileB.stats.followers },
      { key: 'years', label: 'Años activos', a: profileA.stats.yearsActive, b: profileB.stats.yearsActive }
    ];

    const topA = [...profileA.ownRepos]
      .sort((x, y) => (y.stargazers_count || 0) - (x.stargazers_count || 0))
      .slice(0, 3);
    const topB = [...profileB.ownRepos]
      .sort((x, y) => (y.stargazers_count || 0) - (x.stargazers_count || 0))
      .slice(0, 3);

    return {
      profileA,
      profileB,
      metrics,
      affinityPct,
      shared,
      onlyA,
      onlyB,
      topA,
      topB
    };
  }

  const NEURAL_CATEGORIES = [
    {
      id: 'cat:ai',
      label: 'IA & Agentes',
      color: '#c084fc',
      description: 'Modelos generativos, LLMs, agentes autónomos, protocolo MCP e inferencia.',
      searchQuery: 'topic:llm OR topic:ai-agents',
      langs: ['lang:Python', 'lang:TypeScript', 'lang:Rust', 'lang:C++'],
      pattern: /\b(ai|llm|llms|gpt|claude|gemini|openai|anthropic|rag|embedding|transformer|diffusion|machine-learning|deep-learning|langchain|ollama|llama|hugging|neural|inference|agent|agents|mcp|model-context-protocol|copilot|claude-code)\b/i
    },
    {
      id: 'cat:web',
      label: 'Web & Full-Stack',
      color: '#38bdf8',
      description: 'Interfaces modernas, meta-frameworks full-stack, APIs web y navegador.',
      searchQuery: 'topic:nextjs OR topic:react',
      langs: ['lang:TypeScript', 'lang:Python', 'lang:Go'],
      pattern: /\b(react|nextjs|next\.js|vue|svelte|astro|tailwind|frontend|webapp|browser|vite|html|css|dom|ui|dashboard|web|http|graphql|rest)\b/i
    },
    {
      id: 'cat:systems',
      label: 'Sistemas & CLI',
      color: '#fb923c',
      description: 'Herramientas de terminal, motores nativos, compiladores, emuladores y OS.',
      searchQuery: 'topic:cli OR topic:rust',
      langs: ['lang:Rust', 'lang:C++', 'lang:Go'],
      pattern: /\b(cli|terminal|tui|kernel|os|compiler|emulator|daemon|system|native|desktop|tray|monitor|windows|linux|macos|wasm|webassembly|xbox)\b/i
    },
    {
      id: 'cat:cloud',
      label: 'Cloud & DevOps',
      color: '#4ade80',
      description: 'Contenedores, orquestación, proxies, pipelines CI/CD e infraestructura.',
      searchQuery: 'topic:kubernetes OR topic:docker',
      langs: ['lang:Go', 'lang:Python', 'lang:TypeScript'],
      pattern: /\b(docker|kubernetes|k8s|cloud|devops|ci|cd|terraform|serverless|proxy|nginx|infra|deploy|container|github-actions)\b/i
    },
    {
      id: 'cat:data',
      label: 'Datos & GPU',
      color: '#facc15',
      description: 'Bases de datos SQL/NoSQL, búsqueda vectorial, analítica y cómputo en GPU.',
      searchQuery: 'topic:database OR topic:vector-database',
      langs: ['lang:Python', 'lang:SQL', 'lang:Rust', 'lang:C++'],
      pattern: /\b(sql|database|postgres|postgresql|sqlite|redis|analytics|data|etl|gpu|cuda|webgpu|vector|parquet|spark|pandas|benchmark)\b/i
    },
    {
      id: 'cat:mobile',
      label: 'Mobile & Apps',
      color: '#2dd4bf',
      description: 'Aplicaciones nativas y multiplataforma para Android, iOS y escritorio.',
      searchQuery: 'topic:android OR topic:flutter',
      langs: ['lang:Kotlin', 'lang:TypeScript', 'lang:C++'],
      pattern: /\b(android|ios|swift|kotlin|flutter|react-native|mobile|apk|ipa|capacitor)\b/i
    }
  ];

  const NEURAL_LANGUAGES = [
    {
      id: 'lang:Python',
      label: 'Python',
      color: '#3572A5',
      description: 'Lenguaje dominante en IA, automatización, ciencia de datos y servicios backend.',
      searchQuery: 'language:Python stars:>5000',
      matchLanguages: ['Python', 'Jupyter Notebook'],
      pattern: /\b(python|pytorch|tensorflow|fastapi|django|flask|uv|pip)\b/i
    },
    {
      id: 'lang:TypeScript',
      label: 'TypeScript',
      color: '#3178c6',
      description: 'Estándar moderno para web full-stack, SDKs de agentes y apps multiplataforma.',
      searchQuery: 'language:TypeScript stars:>5000',
      matchLanguages: ['TypeScript', 'JavaScript'],
      pattern: /\b(typescript|javascript|nodejs|node\.js|deno|bun|tsx|jsx)\b/i
    },
    {
      id: 'lang:Rust',
      label: 'Rust',
      color: '#dea584',
      description: 'Alto rendimiento y seguridad de memoria para CLIs, runtimes de IA y sistemas.',
      searchQuery: 'language:Rust stars:>5000',
      matchLanguages: ['Rust'],
      pattern: /\b(rust|cargo|crates|tokio|wasm)\b/i
    },
    {
      id: 'lang:Go',
      label: 'Go',
      color: '#00ADD8',
      description: 'Concurrencia nativa y binarios portables para cloud, infraestructura y CLI.',
      searchQuery: 'language:Go stars:>5000',
      matchLanguages: ['Go'],
      pattern: /\b(golang|go\b)\b/i
    },
    {
      id: 'lang:C++',
      label: 'C++',
      color: '#f34b7d',
      description: 'Control directo de hardware, motores de inferencia local, gráficos y emulación.',
      searchQuery: 'language:C++ stars:>5000',
      matchLanguages: ['C++', 'C'],
      pattern: /\b(c\+\+|cpp|cuda|cmake|llvm|vulkan|opengl)\b/i
    },
    {
      id: 'lang:SQL',
      label: 'SQL',
      color: '#e38c00',
      description: 'Lenguaje declarativo central para bases relacionales, analítica y vectores.',
      searchQuery: 'topic:postgresql OR topic:sqlite',
      matchLanguages: ['SQL', 'PLpgSQL', 'TSQL'],
      pattern: /\b(sql|postgres|postgresql|sqlite|duckdb|clickhouse|mysql)\b/i
    },
    {
      id: 'lang:Kotlin',
      label: 'Kotlin',
      color: '#A97BFF',
      description: 'Estándar moderno en Android, multiplataforma móvil y servicios JVM.',
      searchQuery: 'language:Kotlin stars:>2000',
      matchLanguages: ['Kotlin', 'Swift', 'Dart'],
      pattern: /\b(kotlin|android|jetpack|compose|swift|flutter|dart)\b/i
    }
  ];

  const NEURAL_STACKS = [
    {
      id: 'stack:llm',
      label: 'LLMs & MCP',
      color: '#c084fc',
      description: 'Orquestación de agentes, servidores MCP, inferencia local y RAG.',
      searchQuery: 'topic:mcp OR topic:ai-agent',
      langs: ['lang:Python', 'lang:TypeScript', 'lang:Rust', 'lang:C++'],
      cats: ['cat:ai'],
      pattern: /\b(llm|mcp|agent|agents|rag|ollama|claude|openai|gemini|langchain|inference|copilot|claude-code)\b/i
    },
    {
      id: 'stack:react',
      label: 'React & Next.js',
      color: '#38bdf8',
      description: 'Interfaces por componentes, renderizado híbrido y aplicaciones web rápidas.',
      searchQuery: 'topic:nextjs OR topic:react',
      langs: ['lang:TypeScript'],
      cats: ['cat:web'],
      pattern: /\b(react|nextjs|next\.js|vite|tailwind|vue|svelte|astro|frontend|ui)\b/i
    },
    {
      id: 'stack:cli',
      label: 'CLI & WASM',
      color: '#fb923c',
      description: 'Herramientas de terminal interactivas, emuladores y compilación WebAssembly.',
      searchQuery: 'topic:cli OR topic:webassembly',
      langs: ['lang:Rust', 'lang:Go', 'lang:C++'],
      cats: ['cat:systems'],
      pattern: /\b(cli|tui|terminal|wasm|webassembly|emulator|tray|native|blender|3d)\b/i
    },
    {
      id: 'stack:docker',
      label: 'Docker & K8s',
      color: '#4ade80',
      description: 'Contenedores portables, clústeres Kubernetes y automatización cloud.',
      searchQuery: 'topic:docker OR topic:kubernetes',
      langs: ['lang:Go', 'lang:Python'],
      cats: ['cat:cloud'],
      pattern: /\b(docker|kubernetes|k8s|container|terraform|helm|proxy|nginx|devops)\b/i
    },
    {
      id: 'stack:pg',
      label: 'PostgreSQL & Vector',
      color: '#facc15',
      description: 'Almacenamiento transaccional, analítica SQL y bases vectoriales para IA.',
      searchQuery: 'topic:postgresql OR topic:pgvector',
      langs: ['lang:SQL', 'lang:Python', 'lang:Rust'],
      cats: ['cat:data', 'cat:ai'],
      pattern: /\b(postgres|postgresql|sqlite|sql|pgvector|vector|duckdb|redis|database)\b/i
    },
    {
      id: 'stack:mobile',
      label: 'Flutter & Native',
      color: '#2dd4bf',
      description: 'SDKs móviles nativos y multiplataforma con compilación directa.',
      searchQuery: 'topic:flutter OR topic:kotlin-multiplatform',
      langs: ['lang:Kotlin', 'lang:TypeScript'],
      cats: ['cat:mobile'],
      pattern: /\b(flutter|kotlin|swift|android|ios|react-native|mobile)\b/i
    }
  ];

  function assignThreeLayerCoordinates(nodesByLayer) {
    const xCols = [-0.74, 0, 0.74];
    const zArcs = [0.22, -0.18, 0.22];

    nodesByLayer.forEach((colNodes, layerIdx) => {
      const n = colNodes.length;
      for (let i = 0; i < n; i += 1) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const y = (t - 0.5) * 1.66;
        const zDepth = zArcs[layerIdx] + Math.sin(t * Math.PI) * (layerIdx === 1 ? -0.14 : 0.14);
        colNodes[i].x = xCols[layerIdx];
        colNodes[i].y = y;
        colNodes[i].z = zDepth;
      }
    });
  }

  /**
   * Builds a 3-layer semantic neural graph:
   * Layer 0: Major Categories -> Layer 1: Associated Languages -> Layer 2: Key Stacks,
   * enriched with unbiased recent public repositories (last 7 days) or trending fallback.
   */
  function buildTechNeuralGraph(repos, options = {}) {
    const items = Array.isArray(repos) ? repos.slice(0, 200) : [];
    const sampleSize = items.length;
    const totalPublishedCount = Number(options.totalPublishedCount) || sampleSize;
    const sourceKind = options.sourceKind || 'trending';

    const makeNode = (def, layer, kind) => ({
      id: def.id,
      label: def.label,
      layer,
      kind,
      color: def.color,
      description: def.description,
      searchQuery: def.searchQuery,
      repoCount: 0,
      stars: 0,
      repoKeys: [],
      neighbors: new Set(),
      pathwayIds: new Set([def.id]),
      pathwayEdgeKeys: new Set()
    });

    const catNodes = NEURAL_CATEGORIES.map((c) => makeNode(c, 0, 'category'));
    const langNodes = NEURAL_LANGUAGES.map((l) => makeNode(l, 1, 'language'));
    const stackNodes = NEURAL_STACKS.map((s) => makeNode(s, 2, 'stack'));

    const allNodes = [...catNodes, ...langNodes, ...stackNodes];
    const nodeIndex = new Map(allNodes.map((n) => [n.id, n]));

    // Match live trending repos onto the 3-layer taxonomy
    items.forEach((repo) => {
      const repoKey = repo.full_name || repo.name;
      const stars = Number(repo.stargazers_count) || 0;
      const topics = Array.isArray(repo.topics) ? repo.topics : [];
      const corpus = [repo.name || '', repo.description || '', ...topics].join(' ');
      const repoLang = repo.language || '';

      NEURAL_CATEGORIES.forEach((def) => {
        if (def.pattern.test(corpus)) {
          const n = nodeIndex.get(def.id);
          n.repoCount += 1;
          n.stars += stars;
          n.repoKeys.push(repoKey);
        }
      });

      NEURAL_LANGUAGES.forEach((def) => {
        const matchesLangField = def.matchLanguages.includes(repoLang);
        if (matchesLangField || def.pattern.test(corpus)) {
          const n = nodeIndex.get(def.id);
          n.repoCount += 1;
          n.stars += stars;
          n.repoKeys.push(repoKey);
        }
      });

      NEURAL_STACKS.forEach((def) => {
        if (def.pattern.test(corpus)) {
          const n = nodeIndex.get(def.id);
          n.repoCount += 1;
          n.stars += stars;
          n.repoKeys.push(repoKey);
        }
      });
    });

    // Build structural edges: Category -> Language and Language -> Stack
    const edges = [];
    const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    NEURAL_CATEGORIES.forEach((catDef) => {
      catDef.langs.forEach((langId) => {
        const catNode = nodeIndex.get(catDef.id);
        const langNode = nodeIndex.get(langId);
        if (!catNode || !langNode) return;
        const activeBoost = Math.min(catNode.repoCount, langNode.repoCount);
        edges.push({
          key: edgeKey(catDef.id, langId),
          source: catDef.id,
          target: langId,
          weight: Math.min(1, 0.42 + activeBoost * 0.12),
          phase: (edges.length * 0.19) % 1
        });
        catNode.neighbors.add(langId);
        langNode.neighbors.add(catDef.id);
      });
    });

    NEURAL_STACKS.forEach((stackDef) => {
      stackDef.langs.forEach((langId) => {
        const stackNode = nodeIndex.get(stackDef.id);
        const langNode = nodeIndex.get(langId);
        if (!stackNode || !langNode) return;
        const activeBoost = Math.min(stackNode.repoCount, langNode.repoCount);
        edges.push({
          key: edgeKey(langId, stackDef.id),
          source: langId,
          target: stackDef.id,
          weight: Math.min(1, 0.42 + activeBoost * 0.12),
          phase: (edges.length * 0.23) % 1
        });
        stackNode.neighbors.add(langId);
        langNode.neighbors.add(stackDef.id);
      });
    });

    // Compute full semantic pathways across all 3 layers for each node
    NEURAL_CATEGORIES.forEach((catDef) => {
      const catNode = nodeIndex.get(catDef.id);
      catDef.langs.forEach((langId) => {
        catNode.pathwayIds.add(langId);
        catNode.pathwayEdgeKeys.add(edgeKey(catDef.id, langId));
        NEURAL_STACKS.forEach((stackDef) => {
          if (stackDef.cats.includes(catDef.id) && stackDef.langs.includes(langId)) {
            catNode.pathwayIds.add(stackDef.id);
            catNode.pathwayEdgeKeys.add(edgeKey(langId, stackDef.id));
          }
        });
      });
    });

    NEURAL_LANGUAGES.forEach((langDef) => {
      const langNode = nodeIndex.get(langDef.id);
      langNode.neighbors.forEach((nId) => {
        langNode.pathwayIds.add(nId);
        langNode.pathwayEdgeKeys.add(edgeKey(langDef.id, nId));
      });
    });

    NEURAL_STACKS.forEach((stackDef) => {
      const stackNode = nodeIndex.get(stackDef.id);
      stackDef.langs.forEach((langId) => {
        stackNode.pathwayIds.add(langId);
        stackNode.pathwayEdgeKeys.add(edgeKey(langId, stackDef.id));
        stackDef.cats.forEach((catId) => {
          const catDef = NEURAL_CATEGORIES.find((c) => c.id === catId);
          if (catDef && catDef.langs.includes(langId)) {
            stackNode.pathwayIds.add(catId);
            stackNode.pathwayEdgeKeys.add(edgeKey(catId, langId));
          }
        });
      });
    });

    assignThreeLayerCoordinates([catNodes, langNodes, stackNodes]);

    const maxCount = Math.max(1, ...allNodes.map((n) => n.repoCount));
    const denom = Math.max(1, sampleSize);
    const cleanNodes = allNodes.map((n) => {
      const rel = n.repoCount / maxCount;
      const weight = Math.min(1, 0.25 + rel * 0.75);
      const sharePct = Math.round((n.repoCount / denom) * 100);
      return {
        id: n.id,
        label: n.label,
        layer: n.layer,
        kind: n.kind,
        color: n.color,
        description: n.description,
        searchQuery: n.searchQuery,
        repoCount: n.repoCount,
        sharePct,
        stars: n.stars,
        repoKeys: n.repoKeys,
        x: n.x,
        y: n.y,
        z: n.z,
        weight,
        radius: Math.round(9 + weight * 9),
        neighborIds: Array.from(n.neighbors),
        pathwayIds: Array.from(n.pathwayIds),
        pathwayEdgeKeys: Array.from(n.pathwayEdgeKeys)
      };
    });

    const topCategory = [...cleanNodes]
      .filter((n) => n.layer === 0)
      .sort((a, b) => b.repoCount - a.repoCount || b.stars - a.stars)[0];

    return {
      nodes: cleanNodes,
      edges,
      repoTotal: sampleSize,
      sampleSize,
      totalPublishedCount,
      sourceKind,
      defaultFocusId: topCategory ? topCategory.id : cleanNodes[0].id
    };
  }

  root.analytics = {
    VOXEL_PALETTE,
    buildAnnualActivityMatrix,
    buildProfileModel,
    buildDuelModel,
    buildTechNeuralGraph
  };
})();
