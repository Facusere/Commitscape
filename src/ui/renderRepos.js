(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  function getFilteredRepos(profile, state) {
    const f = state.filters;
    const q = f.query.trim().toLowerCase();

    const filtered = profile.repos.filter((repo) => {
      if (!f.includeForks && repo.fork) return false;
      if (!f.includeArchived && repo.archived) return false;
      if (state.activeLanguage && repo.language !== state.activeLanguage) return false;

      if (q) {
        const hayName = (repo.name || '').toLowerCase().includes(q);
        const hayDesc = (repo.description || '').toLowerCase().includes(q);
        const hayLang = (repo.language || '').toLowerCase().includes(q);
        const hayTopic = Array.isArray(repo.topics) && repo.topics.some((t) => t.toLowerCase().includes(q));
        if (!hayName && !hayDesc && !hayLang && !hayTopic) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (f.sortBy === 'forks') return (b.forks_count || 0) - (a.forks_count || 0);
      if (f.sortBy === 'updated') return Date.parse(b.pushed_at || b.updated_at || 0) - Date.parse(a.pushed_at || a.updated_at || 0);
      if (f.sortBy === 'size') return (b.size || 0) - (a.size || 0);
      if (f.sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'es');
      return (b.stargazers_count || 0) - (a.stargazers_count || 0);
    });

    return filtered;
  }

  function renderCartridgeHtml(repo, index) {
    const { esc, formatCompact, timeAgo } = root.utils;
    const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];
    const flags = [];
    if (repo.fork) flags.push('<span class="topic-pill">fork</span>');
    if (repo.archived) flags.push('<span class="topic-pill">archivado</span>');

    return `
      <button type="button" class="repo-card" data-repo-name="${esc(repo.name)}">
        <div class="repo-card-top">
          <h4 class="repo-title">${esc(repo.name)}</h4>
          <span class="repo-star-badge">★ ${formatCompact(repo.stargazers_count || 0)}</span>
        </div>

        <p class="repo-desc">${esc(repo.description || 'Sin descripción registrada.')}</p>

        ${(topics.length || flags.length) ? `
          <div class="repo-topics">
            ${flags.join('')}
            ${topics.map((t) => `<span class="topic-pill">#${esc(t)}</span>`).join('')}
          </div>
        ` : ''}

        <div class="repo-card-foot">
          <span class="lang-logo-wrap">
            ${root.colors.getLangIconHtml(repo.language, index)}
            <span>${esc(repo.language || 'Otro')}</span>
          </span>
          <span class="repo-mini-meta">
            <span>⑂ ${formatCompact(repo.forks_count || 0)}</span>
            <span>${esc(timeAgo(repo.pushed_at || repo.updated_at))}</span>
          </span>
        </div>
      </button>
    `;
  }

  function renderCardsOnly(gridEl, footerEl, profile, handlers) {
    const state = root.state;
    const filtered = getFilteredRepos(profile, state);
    const slice = filtered.slice(0, state.visibleRepoCount);

    if (slice.length === 0) {
      gridEl.innerHTML = `<p class="banner banner-info">No hay repositorios que coincidan con los filtros actuales.</p>`;
    } else {
      gridEl.innerHTML = slice.map((repo, idx) => renderCartridgeHtml(repo, idx)).join('');
      gridEl.querySelectorAll('.repo-card').forEach((card) => {
        card.addEventListener('click', () => {
          const repo = profile.repos.find((r) => r.name === card.dataset.repoName);
          if (repo) openInspectorModal(profile.user.login, repo);
        });
      });
    }

    const remaining = filtered.length - slice.length;
    const pag = state.currentReposPagination;
    const parts = [];
    if (remaining > 0) {
      parts.push(`<button type="button" class="btn btn-sm" id="btn-show-more-repos">Mostrar más (${remaining} restantes cargados)</button>`);
    }
    if (pag && pag.hasMore) {
      parts.push(`<button type="button" class="btn btn-primary btn-sm" id="btn-fetch-next-page">Cargar +100 repos desde GitHub (pág. ${pag.nextPage})</button>`);
    }
    footerEl.innerHTML = parts.join('');

    const showMoreBtn = footerEl.querySelector('#btn-show-more-repos');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => {
        state.visibleRepoCount += 12;
        renderCardsOnly(gridEl, footerEl, profile, handlers);
      });
    }

    const fetchPageBtn = footerEl.querySelector('#btn-fetch-next-page');
    if (fetchPageBtn && handlers.onLoadMorePages) {
      fetchPageBtn.addEventListener('click', () => handlers.onLoadMorePages(fetchPageBtn));
    }
  }

  /** Renders the repository explorer bar and stationary repository cards. */
  function renderReposExplorer(container, profile, handlers) {
    const { esc } = root.utils;
    const state = root.state;
    const f = state.filters;
    const filteredCount = getFilteredRepos(profile, state).length;

    container.innerHTML = `
      <section class="section-block" aria-label="Explorador de Repositorios">
        <div class="section-head">
          <h3 class="section-title">
            Repositorios
            <span class="context-submeta" id="repos-count-badge">${filteredCount} de ${profile.repos.length}</span>
          </h3>
        </div>

        <div class="explorer-bar">
          <input id="repo-filter-q" class="field-plain" type="search" placeholder="Filtrar por nombre, descripción o #topic…" value="${esc(f.query)}">
          <select id="repo-sort" class="field-select" aria-label="Ordenar repositorios">
            <option value="stars" ${f.sortBy === 'stars' ? 'selected' : ''}>Orden: Más estrellas ★</option>
            <option value="forks" ${f.sortBy === 'forks' ? 'selected' : ''}>Orden: Más forks ⑂</option>
            <option value="updated" ${f.sortBy === 'updated' ? 'selected' : ''}>Orden: Más recientes</option>
            <option value="size" ${f.sortBy === 'size' ? 'selected' : ''}>Orden: Mayor tamaño</option>
            <option value="name" ${f.sortBy === 'name' ? 'selected' : ''}>Orden: Alfabético (A-Z)</option>
          </select>
          <label class="check-pill">
            <input type="checkbox" id="chk-forks" ${f.includeForks ? 'checked' : ''}> Incluir forks
          </label>
          <label class="check-pill">
            <input type="checkbox" id="chk-archived" ${f.includeArchived ? 'checked' : ''}> Archivados
          </label>
          ${state.activeLanguage ? `
            <span class="active-filter-tag">
              Lenguaje: ${esc(state.activeLanguage)}
              <button type="button" id="btn-clear-lang" aria-label="Quitar filtro de lenguaje">×</button>
            </span>
          ` : ''}
        </div>

        <div class="repos-grid" id="repos-grid"></div>
        <div class="repos-footer" id="repos-footer"></div>
      </section>
    `;

    const gridEl = container.querySelector('#repos-grid');
    const footerEl = container.querySelector('#repos-footer');
    const countBadge = container.querySelector('#repos-count-badge');

    const updateList = () => {
      const totalMatched = getFilteredRepos(profile, state).length;
      if (countBadge) countBadge.textContent = `${totalMatched} de ${profile.repos.length}`;
      renderCardsOnly(gridEl, footerEl, profile, handlers);
    };

    const searchInput = container.querySelector('#repo-filter-q');
    searchInput.addEventListener('input', root.utils.debounce(() => {
      state.filters.query = searchInput.value;
      state.visibleRepoCount = 12;
      updateList();
    }, 120));

    container.querySelector('#repo-sort').addEventListener('change', (ev) => {
      state.filters.sortBy = ev.target.value;
      updateList();
    });

    container.querySelector('#chk-forks').addEventListener('change', (ev) => {
      state.filters.includeForks = ev.target.checked;
      state.visibleRepoCount = 12;
      updateList();
    });

    container.querySelector('#chk-archived').addEventListener('change', (ev) => {
      state.filters.includeArchived = ev.target.checked;
      state.visibleRepoCount = 12;
      updateList();
    });

    const clearLangBtn = container.querySelector('#btn-clear-lang');
    if (clearLangBtn && handlers.onClearLanguage) {
      clearLangBtn.addEventListener('click', handlers.onClearLanguage);
    }

    renderCardsOnly(gridEl, footerEl, profile, handlers);
  }

  function resolveRepoUrl(rawUrl, owner, repoName, branch, isRaw = false) {
    const { safeUrl } = root.utils;
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('#')) return '';
    if (/^[a-z]+:/i.test(trimmed)) {
      return safeUrl(trimmed);
    }
    const cleanRel = trimmed.replace(/^\.?\//, '');
    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repoName);
    const safeBranch = encodeURIComponent(branch || 'main');
    if (isRaw) {
      return `https://raw.githubusercontent.com/${safeOwner}/${safeRepo}/${safeBranch}/${cleanRel}`;
    }
    return `https://github.com/${safeOwner}/${safeRepo}/blob/${safeBranch}/${cleanRel}`;
  }

  /** Converts repository Markdown into bounded, XSS-safe HTML. */
  function renderSafeMarkdownHtml(markdown, owner, repoName, defaultBranch = 'main') {
    const { esc } = root.utils;
    const source = String(markdown || '').replace(/\r\n/g, '\n');
    if (!source.trim()) {
      return '<p style="color:var(--text-muted);font-size:0.82rem">Este repositorio tiene un README vacío.</p>';
    }

    const capped = source.length > 42000
      ? source.slice(0, 42000) + '\n\n_Contenido resumido para vista rápida…_'
      : source;

    const formatInline = (raw) => {
      const tokens = [];
      const stash = (html) => {
        const idx = tokens.length;
        tokens.push(html);
        return `\u0000TOK${idx}\u0000`;
      };

      let work = String(raw || '');

      // Preserve inline code spans first so brackets/tags inside code render literally
      work = work.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${esc(code)}</code>`));

      // Convert safe inline HTML images, links, bold/italic, and strip presentational wrappers
      work = work.replace(/<img\b[^>]*>/gi, (tag) => {
        const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
        if (!srcMatch) return '';
        const resolved = resolveRepoUrl(srcMatch[1], owner, repoName, defaultBranch, true);
        if (!resolved) return '';
        const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1] : 'imagen';
        return stash(`<img class="readme-img" src="${esc(resolved)}" alt="${esc(alt)}" loading="lazy">`);
      });
      work = work.replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
        const resolved = resolveRepoUrl(href, owner, repoName, defaultBranch, false);
        const cleanLbl = String(label || '').replace(/<[^>]+>/g, '').trim();
        if (!resolved) return cleanLbl;
        return stash(`<a href="${esc(resolved)}" target="_blank" rel="noopener noreferrer">${esc(cleanLbl || resolved)}</a>`);
      });
      work = work.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
      work = work.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
      work = work.replace(/<\/?(h[1-6]|div|p|span|center|br|hr|picture|source|a|b|strong|i|em|u|sub|sup|small|details|summary|table|thead|tbody|tr|th|td|kbd|code)\b[^>]*>/gi, ' ');

      // Images: ![alt](src)
      work = work.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, src) => {
        const resolved = resolveRepoUrl(src, owner, repoName, defaultBranch, true);
        if (!resolved) return '';
        return stash(`<img class="readme-img" src="${esc(resolved)}" alt="${esc(alt || 'imagen')}" loading="lazy">`);
      });

      // Links: [label](href)
      work = work.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, href) => {
        const resolved = resolveRepoUrl(href, owner, repoName, defaultBranch, false);
        if (!resolved) return esc(label);
        return stash(`<a href="${esc(resolved)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`);
      });

      let safe = esc(work);
      safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      safe = safe.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      safe = safe.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      safe = safe.replace(/\u0000TOK(\d+)\u0000/g, (_, idx) => tokens[Number(idx)] || '');
      return safe;
    };

    const lines = capped.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim();
        const codeLines = [];
        i += 1;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i += 1;
        }
        i += 1;
        blocks.push(`<pre class="readme-code" data-lang="${esc(lang)}"><code>${esc(codeLines.join('\n'))}</code></pre>`);
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = Math.min(6, headingMatch[1].length + 2);
        blocks.push(`<h${level} class="readme-h">${formatInline(headingMatch[2])}</h${level}>`);
        i += 1;
        continue;
      }

      const htmlHeading = trimmed.match(/^<h([1-6])\b[^>]*>([\s\S]+?)<\/h\1>\s*$/i);
      if (htmlHeading) {
        const level = Math.min(6, Number(htmlHeading[1]) + 2);
        blocks.push(`<h${level} class="readme-h">${formatInline(htmlHeading[2])}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^([-*_]){3,}$/.test(trimmed)) {
        blocks.push('<hr class="readme-hr">');
        i += 1;
        continue;
      }

      if (trimmed.startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i += 1;
        }
        blocks.push(`<blockquote class="readme-quote">${formatInline(quoteLines.join(' '))}</blockquote>`);
        continue;
      }

      if (/^[-*+]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
          items.push(`<li>${formatInline(lines[i].trim().replace(/^[-*+]\s+/, ''))}</li>`);
          i += 1;
        }
        blocks.push(`<ul class="readme-list">${items.join('')}</ul>`);
        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push(`<li>${formatInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
          i += 1;
        }
        blocks.push(`<ol class="readme-list">${items.join('')}</ol>`);
        continue;
      }

      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith('```') &&
        !/^(#{1,6})\s+/.test(lines[i].trim()) &&
        !lines[i].trim().startsWith('>') &&
        !/^[-*+]\s+/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim()) &&
        !/^([-*_]){3,}$/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i].trim());
        i += 1;
      }
      if (paraLines.length) {
        blocks.push(`<p>${formatInline(paraLines.join(' '))}</p>`);
      }
    }

    return blocks.join('\n') || '<p style="color:var(--text-muted);font-size:0.82rem">Sin contenido visible en README.</p>';
  }

  /** Opens the 180-degree rotating Capsule Inspector dialog with Architecture, Activity, and README faces. */
  async function openInspectorModal(owner, repo) {
    const dialog = document.getElementById('repo-dialog');
    const body = document.getElementById('repo-dialog-body');
    if (!dialog || !body) return;

    const { esc, safeUrl, formatNumber, formatBytes, timeAgo } = root.utils;
    const repoUrl = safeUrl(repo.html_url);
    const homeUrl = safeUrl(repo.homepage);
    const cloneHttps = `git clone https://github.com/${owner}/${repo.name}.git`;
    const cloneGh = `gh repo clone ${owner}/${repo.name}`;
    const licenseName = repo.license && repo.license.spdx_id && repo.license.spdx_id !== 'NOASSERTION'
      ? repo.license.spdx_id
      : 'Sin licencia especificada';

    body.innerHTML = `
      <div class="capsule-perspective">
        <div class="capsule-flipper" id="capsule-flipper" data-side="front">
          <section class="capsule-face capsule-face-front" aria-label="Cara A: Arquitectura y Métricas">
            <div class="capsule-head">
              <div>
                <h3>${esc(repo.name)}</h3>
                <small style="color:var(--text-muted)">${esc(owner)}/${esc(repo.name)} · Rama ${esc(repo.default_branch || 'main')}</small>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" data-close-modal aria-label="Cerrar inspector">✕ Cerrar</button>
            </div>

            <p style="color:var(--text-soft);font-size:0.88rem">${esc(repo.description || 'Sin descripción disponible.')}</p>

            <div class="pat-stats-grid">
              <div class="pat-stat"><small>Estrellas</small><strong>★ ${formatNumber(repo.stargazers_count || 0)}</strong></div>
              <div class="pat-stat"><small>Forks</small><strong>⑂ ${formatNumber(repo.forks_count || 0)}</strong></div>
              <div class="pat-stat"><small>Issues abiertos</small><strong>${formatNumber(repo.open_issues_count || 0)}</strong></div>
              <div class="pat-stat"><small>Tamaño repo</small><strong>${formatBytes((repo.size || 0) * 1024)}</strong></div>
            </div>

            <div style="font-size:0.8rem;color:var(--text-soft);margin-bottom:6px">
              Composición de lenguajes (bytes reales):
            </div>
            <div id="capsule-lang-breakdown">
              <p style="font-size:0.78rem;color:var(--text-muted)">Cargando desglose exacto desde GitHub…</p>
            </div>

            <div style="font-size:0.78rem;color:var(--text-muted);margin:10px 0">
              Licencia: <strong style="color:var(--text-main)">${esc(licenseName)}</strong> · Último push ${esc(timeAgo(repo.pushed_at))}
            </div>

            <div class="pat-actions">
              <button type="button" class="btn btn-primary btn-sm" data-flip-target="activity">↻ Actividad y Clone</button>
              <button type="button" class="btn btn-primary btn-sm" data-flip-target="readme">📖 Ver README</button>
              ${repoUrl ? `<a class="btn btn-sm" href="${esc(repoUrl)}" target="_blank" rel="noopener noreferrer">Abrir en GitHub ↗</a>` : ''}
              ${homeUrl ? `<a class="btn btn-sm" href="${esc(homeUrl)}" target="_blank" rel="noopener noreferrer">Demo en vivo ↗</a>` : ''}
            </div>
          </section>

          <section class="capsule-face capsule-face-back is-active-back" id="capsule-face-activity" aria-label="Cara B: Actividad y Clonado">
            <div class="capsule-head">
              <div>
                <h3>Actividad y Clonado · ${esc(repo.name)}</h3>
                <small style="color:var(--text-muted)">Historial reciente y acceso rápido</small>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" data-close-modal aria-label="Cerrar inspector">✕ Cerrar</button>
            </div>

            <div style="font-size:0.8rem;color:var(--text-soft)">Comandos rápidos:</div>
            <div class="clone-box">
              <code>${esc(cloneHttps)}</code>
              <button type="button" class="btn btn-sm" data-copy="${esc(cloneHttps)}">Copiar</button>
            </div>
            <div class="clone-box">
              <code>${esc(cloneGh)}</code>
              <button type="button" class="btn btn-sm" data-copy="${esc(cloneGh)}">Copiar</button>
            </div>

            <div style="font-size:0.8rem;color:var(--text-soft);margin-top:12px">Últimos commits públicos:</div>
            <div class="commit-timeline" id="capsule-commits">
              <p style="font-size:0.78rem;color:var(--text-muted)">Consultando historial reciente…</p>
            </div>

            <div class="pat-actions">
              <button type="button" class="btn btn-primary btn-sm" data-flip-target="front">↺ Volver a Arquitectura</button>
              <button type="button" class="btn btn-sm" data-flip-target="readme">📖 Ver README</button>
            </div>
          </section>

          <section class="capsule-face capsule-face-back" id="capsule-face-readme" aria-label="Cara C: README Principal">
            <div class="capsule-head">
              <div>
                <h3 id="capsule-readme-title">README Principal · ${esc(repo.name)}</h3>
                <small style="color:var(--text-muted)">${esc(owner)}/${esc(repo.name)}</small>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" data-close-modal aria-label="Cerrar inspector">✕ Cerrar</button>
            </div>

            <div class="capsule-readme-body" id="capsule-readme-box">
              <p style="font-size:0.78rem;color:var(--text-muted)">Cargando README.md desde GitHub…</p>
            </div>

            <div class="pat-actions">
              <button type="button" class="btn btn-primary btn-sm" data-flip-target="front">↺ Volver a Arquitectura</button>
              <button type="button" class="btn btn-sm" data-flip-target="activity">↻ Actividad y Clone</button>
              <span id="capsule-readme-ext"></span>
            </div>
          </section>
        </div>
      </div>
    `;

    const flipper = body.querySelector('#capsule-flipper');
    const faceActivity = body.querySelector('#capsule-face-activity');
    const faceReadme = body.querySelector('#capsule-face-readme');
    let swapTimer = null;

    function activateBackFace(targetSide) {
      faceActivity.classList.toggle('is-active-back', targetSide !== 'readme');
      faceReadme.classList.toggle('is-active-back', targetSide === 'readme');
    }

    function rotateCapsuleTo(target) {
      if (swapTimer) {
        clearTimeout(swapTimer);
        swapTimer = null;
      }
      const current = flipper.dataset.side || 'front';
      if (target === 'front') {
        flipper.dataset.side = 'front';
        return;
      }
      if ((current === 'activity' && target === 'readme') || (current === 'readme' && target === 'activity')) {
        flipper.dataset.side = target;
        swapTimer = setTimeout(() => {
          activateBackFace(target);
        }, 160);
        return;
      }
      activateBackFace(target);
      flipper.dataset.side = target;
    }

    body.querySelectorAll('[data-flip-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        rotateCapsuleTo(btn.dataset.flipTarget);
      });
    });

    body.querySelectorAll('[data-close-modal]').forEach((b) => {
      b.addEventListener('click', () => dialog.close());
    });
    body.querySelectorAll('[data-copy]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy);
          root.notify('Comando copiado al portapapeles.');
        } catch {
          root.notify('No se pudo copiar automáticamente.');
        }
      });
    });

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
    }

    const [langsResult, commits, readme] = await Promise.all([
      root.api.fetchRepoLanguages(owner, repo.name).catch(() => null),
      root.api.fetchRepoCommits(owner, repo.name).catch(() => []),
      root.api.fetchRepoReadme(owner, repo.name).catch(() => null)
    ]);

    const langBox = body.querySelector('#capsule-lang-breakdown');
    if (langBox) {
      const entries = Object.entries(langsResult || {});
      const total = entries.reduce((sum, [, v]) => sum + v, 0);
      if (total > 0) {
        const items = entries
          .sort((a, b) => b[1] - a[1])
          .map(([lang, bytes], idx) => ({
            lang,
            bytes,
            pct: (bytes / total) * 100,
            color: root.colors.getLangColor(lang, idx)
          }));

        langBox.innerHTML = `
          <div class="capsule-bar3d">
            ${items.map((i) => `<div class="capsule-seg" style="width:${Math.max(2, i.pct).toFixed(2)}%;background:${esc(i.color)}" title="${esc(i.lang)} ${i.pct.toFixed(1)}%"></div>`).join('')}
          </div>
          <div class="capsule-lang-list">
            ${items.slice(0, 7).map((i) => `
              <span class="lang-dot-item">
                <i class="lang-dot" style="background:${esc(i.color)}"></i>
                <strong>${esc(i.lang)}</strong> ${i.pct.toFixed(1)}% (${esc(formatBytes(i.bytes))})
              </span>
            `).join('')}
          </div>
        `;
      } else {
        langBox.innerHTML = `<p style="font-size:0.78rem;color:var(--text-muted)">Sin desglose en bytes disponible.</p>`;
      }
    }

    const commitsBox = body.querySelector('#capsule-commits');
    if (commitsBox) {
      if (commits && commits.length > 0) {
        commitsBox.innerHTML = commits.slice(0, 6).map((c) => {
          const msg = (c.commit && c.commit.message ? c.commit.message.split('\n')[0] : 'Commit').slice(0, 90);
          const author = (c.commit && c.commit.author && c.commit.author.name) || 'Autor';
          const dt = c.commit && c.commit.author && c.commit.author.date;
          return `
            <div class="commit-item">
              <span class="commit-node3d" aria-hidden="true"></span>
              <div>
                <strong>${esc(msg)}</strong>
                <div style="color:var(--text-muted);font-size:0.72rem">${esc(author)} · ${esc(timeAgo(dt))}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        commitsBox.innerHTML = `<p style="font-size:0.78rem;color:var(--text-muted)">No fue posible cargar los últimos commits.</p>`;
      }
    }

    const readmeBox = body.querySelector('#capsule-readme-box');
    const readmeTitle = body.querySelector('#capsule-readme-title');
    const readmeExt = body.querySelector('#capsule-readme-ext');
    if (readmeBox) {
      if (readme && readme.markdown) {
        if (readmeTitle) readmeTitle.textContent = `${readme.name || 'README.md'} · ${repo.name}`;
        readmeBox.innerHTML = renderSafeMarkdownHtml(readme.markdown, owner, repo.name, repo.default_branch || 'main');
        const extUrl = safeUrl(readme.htmlUrl);
        if (readmeExt && extUrl) {
          readmeExt.innerHTML = `<a class="btn btn-sm" href="${esc(extUrl)}" target="_blank" rel="noopener noreferrer">Ver en GitHub ↗</a>`;
        }
      } else {
        readmeBox.innerHTML = `<p style="font-size:0.82rem;color:var(--text-muted)">Este repositorio no cuenta con un README público disponible.</p>`;
      }
    }
  }

  root.renderRepos = {
    renderReposExplorer,
    openInspectorModal
  };
})();
