(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const LAYER_LABELS = {
    0: 'Gran Categoría',
    1: 'Lenguaje Asociado',
    2: 'Stack / Ecosistema'
  };

  let activeNeuralCtrl = null;
  let ctxRafId = null;

  function cleanup() {
    if (ctxRafId) {
      cancelAnimationFrame(ctxRafId);
      ctxRafId = null;
    }
    if (activeNeuralCtrl && typeof activeNeuralCtrl.destroy === 'function') {
      activeNeuralCtrl.destroy();
    }
    activeNeuralCtrl = null;
  }

  function refreshTheme() {
    if (activeNeuralCtrl && typeof activeNeuralCtrl.redrawTheme === 'function') {
      activeNeuralCtrl.redrawTheme();
    }
  }

  function renderTrendingCardHtml(repo, rankIndex) {
    const { esc, safeUrl, formatCompact, timeAgo } = root.utils;
    const rank = rankIndex + 1;
    const rankClass = rank <= 3 ? `rank-badge is-top-${rank}` : 'rank-badge';
    const ownerLogin = (repo.owner && repo.owner.login) || 'github';
    const ownerAvatar = safeUrl(repo.owner && repo.owner.avatar_url);
    const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];
    const createdLabel = timeAgo(repo.created_at || repo.pushed_at);

    return `
      <article class="repo-card trending-card card-cascade-in" style="--card-delay:${Math.min(rankIndex, 15) * 24}ms" tabindex="0" role="button" data-repo-full="${esc(repo.full_name || repo.name)}">
        <div class="trending-meta-row">
          <span class="${rankClass}">#${rank}</span>
          <button type="button" class="owner-chip" data-open-owner="${esc(ownerLogin)}" title="Ver perfil completo de @${esc(ownerLogin)}">
            ${ownerAvatar ? `<img src="${esc(ownerAvatar)}" alt="" aria-hidden="true">` : ''}
            <span>@${esc(ownerLogin)}</span>
          </button>
        </div>

        <div class="repo-card-top">
          <h4 class="repo-title">${esc(repo.name)}</h4>
          <span class="repo-star-badge">★ ${formatCompact(repo.stargazers_count || 0)}</span>
        </div>

        <p class="repo-desc">${esc(repo.description || 'Sin descripción registrada.')}</p>

        ${topics.length ? `
          <div class="repo-topics">
            ${topics.map((t) => `<span class="topic-pill">#${esc(t)}</span>`).join('')}
          </div>
        ` : ''}

        <div class="repo-card-foot">
          <span class="lang-logo-wrap">
            ${root.colors.getLangIconHtml(repo.language, rankIndex)}
            <span>${esc(repo.language || 'Otro')}</span>
          </span>
          <span class="repo-mini-meta">
            <span>⑂ ${formatCompact(repo.forks_count || 0)}</span>
            <span>${esc(createdLabel)}</span>
          </span>
        </div>
      </article>
    `;
  }

  function formatHoverSummary(node, graph) {
    const { esc, formatCompact } = root.utils;
    if (!node) {
      if (graph.sourceKind === 'recent_7d') {
        return `Red calculada con ${graph.sampleSize} repos publicados en los últimos 7 días (sin filtro de estrellas, sobre ${formatCompact(graph.totalPublishedCount)} en GitHub)`;
      }
      return `Pasá o hacé clic en un nodo de la red (Categoría → Lenguaje → Stack) para explorar sus tecnologías asociadas`;
    }
    const kind = LAYER_LABELS[node.layer] || 'Tecnología';
    if (graph.sourceKind === 'recent_7d') {
      return `<strong>${esc(node.label)}</strong> (${esc(kind)}) · ${node.sharePct}% de publicaciones recientes (${node.repoCount} de ${graph.sampleSize})`;
    }
    return `<strong>${esc(node.label)}</strong> (${esc(kind)}) · ${node.repoCount} en tendencias · ★ ${esc(formatCompact(node.stars))}`;
  }

  function renderContextPanelHtml(node, graph, state) {
    const { esc, formatCompact } = root.utils;
    if (!node) return '';

    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const related = (node.neighborIds || []).map((id) => nodeMap.get(id)).filter(Boolean);

    const groupA = related.filter((n) => n.layer === 0);
    const groupB = related.filter((n) => n.layer === 1);
    const groupC = related.filter((n) => n.layer === 2);

    const isRecent = graph.sourceKind === 'recent_7d';
    const renderGroup = (title, list) => {
      if (!list.length) return '';
      return `
        <div class="context-links-group">
          <span class="chip-label">${esc(title)}:</span>
          ${list.map((item) => {
            const badge = isRecent
              ? (item.sharePct > 0 ? ` (${item.sharePct}%)` : '')
              : (item.repoCount > 0 ? ` (${item.repoCount})` : '');
            return `
              <button type="button" class="chip-btn" data-jump-node="${esc(item.id)}" style="border-color:${esc(item.color)}55">
                ${esc(item.label)}${esc(badge)}
              </button>
            `;
          }).join('')}
        </div>
      `;
    };

    const isFiltered = state.trendingFilter && state.trendingFilter.id === node.id;
    const isExploring = state.trendingExplore && state.trendingExplore.id === node.id;
    const shareNum = Number(node.sharePct) || 0;
    const countNum = Number(node.repoCount) || 0;
    const metricBadgeHtml = isRecent
      ? `<span data-countup="${shareNum}" data-suffix="%">${shareNum}%</span> de publicaciones (<span data-countup="${countNum}">${countNum}</span> en muestra)`
      : `<span data-countup="${countNum}">${countNum}</span> en tendencias${node.stars > 0 ? ` · ★ ${esc(formatCompact(node.stars))}` : ''}`;

    const filterLabel = isRecent
      ? (isFiltered ? '✓ Viendo publicados' : `Ver publicados (${node.repoCount})`)
      : (isFiltered ? '✓ Filtrando tendencias' : `Filtrar tendencias (${node.repoCount})`);

    return `
      <div class="context-head">
        <div>
          <div class="context-title-row">
            ${root.colors.getLangIconHtml(node.id || node.label, 0)}
            <h4 class="context-title">${esc(node.label)}</h4>
            <span class="context-submeta">${esc(LAYER_LABELS[node.layer] || 'Tecnología')} · ${metricBadgeHtml}</span>
          </div>
          <p class="context-desc">${esc(node.description || '')}</p>
        </div>
        <div class="context-actions">
          ${node.repoCount > 0 ? `
            <button type="button" class="btn btn-sm ${isFiltered ? 'btn-primary' : ''}" id="btn-ctx-filter">
              ${esc(filterLabel)}
            </button>
          ` : ''}
          <button type="button" class="btn btn-primary btn-sm" id="btn-ctx-explore">
            ${isExploring ? '✓ Viendo top en GitHub' : 'Explorar top en GitHub →'}
          </button>
        </div>
      </div>

      <div class="context-links-row">
        ${node.layer === 0 ? renderGroup('Lenguajes asociados', groupB) : ''}
        ${node.layer === 1 ? renderGroup('Categorías', groupA) + renderGroup('Stacks que impulsa', groupC) : ''}
        ${node.layer === 2 ? renderGroup('Lenguajes base', groupB) + renderGroup('Categorías', groupA) : ''}
      </div>
    `;
  }

  /**
   * Renders Home with the 3-layer Technology Ecosystem (fed by unbiased 7-day recent
   * community repositories when available) above the Popular Repositories grid.
   */
  function renderTrendingHome(container, payload, state, handlers) {
    cleanup();

    const { esc } = root.utils;
    const trendingItems = Array.isArray(payload && payload.trending && payload.trending.items)
      ? payload.trending.items
      : [];
    const recent = payload && payload.recentPublished;
    const hasRecent = Boolean(recent && Array.isArray(recent.items) && recent.items.length > 0);
    const ecosystemItems = hasRecent ? recent.items : trendingItems;

    const graph = root.analytics.buildTechNeuralGraph(ecosystemItems, {
      sourceKind: hasRecent ? 'recent_7d' : 'trending',
      totalPublishedCount: hasRecent ? recent.totalCount : trendingItems.length
    });

    const activeRange = state.trendingRange || 'week';
    const categories = graph.nodes.filter((n) => n.layer === 0);

    container.innerHTML = `
      <section class="section-block" style="margin-top:0" aria-label="Ecosistema tecnológico de publicaciones recientes">
        <article class="scene-card" style="margin-bottom:26px">
          <div class="section-head">
            <h2 class="section-title">Ecosistema Tecnológico</h2>
            <div class="stage-toolbar">
              <button type="button" class="btn btn-ghost btn-sm" id="btn-neural-auto" title="Pausar o reanudar movimiento">⏸</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-neural-reset" title="Restablecer vista">⌖ Restablecer</button>
            </div>
          </div>

          <div class="neural-stage">
            <canvas id="tech-neural-canvas" class="neural-canvas" aria-label="Red neuronal de grandes categorías, lenguajes asociados y stacks"></canvas>
          </div>

          <div class="neural-hud" id="neural-hover-bar">
            <span id="neural-hud-text">${formatHoverSummary(null, graph)}</span>
            <span class="neural-legend" aria-hidden="true">
              <span><i class="neural-dot is-dom"></i>Categoría</span>
              <span><i class="neural-dot is-lang"></i>Lenguaje</span>
              <span><i class="neural-dot is-stack"></i>Stack</span>
            </span>
          </div>

          <div class="neural-context-panel" id="neural-context-panel"></div>
        </article>

        <div class="section-head">
          <h2 class="section-title">Repositorios populares</h2>
          <div class="stage-toolbar">
            <div class="segmented" role="group" aria-label="Período de popularidad">
              <button type="button" class="seg-btn ${activeRange === 'week' ? 'is-active' : ''}" data-trending-range="week">Última semana</button>
              <button type="button" class="seg-btn ${activeRange === 'month' ? 'is-active' : ''}" data-trending-range="month">Último mes</button>
              <button type="button" class="seg-btn ${activeRange === 'all' ? 'is-active' : ''}" data-trending-range="all">Históricos</button>
            </div>
          </div>
        </div>

        <div class="chip-row trending-lang-filters" id="trending-cat-chips" aria-label="Explorar publicaciones por gran categoría">
          <span class="chip-label">Categoría:</span>
          <button type="button" class="chip-btn ${!state.trendingFilter && !state.trendingExplore ? 'is-active-chip' : ''}" data-cat-id="">Populares (${trendingItems.length})</button>
          ${categories.map((c) => `
            <button type="button"
              class="chip-btn ${state.selectedNeuralId === c.id ? 'is-active-chip' : ''}"
              data-cat-id="${esc(c.id)}">
              ${esc(c.label)} (${hasRecent ? c.sharePct + '%' : c.repoCount})
            </button>
          `).join('')}
        </div>

        <div id="explore-status-slot"></div>
        <div class="repos-grid" id="home-trending-grid"></div>
      </section>
    `;

    const gridEl = container.querySelector('#home-trending-grid');
    const chipsWrap = container.querySelector('#trending-cat-chips');
    const hudText = container.querySelector('#neural-hud-text');
    const contextPanel = container.querySelector('#neural-context-panel');
    const exploreSlot = container.querySelector('#explore-status-slot');

    function getFocusNode() {
      const targetId = state.selectedNeuralId || graph.defaultFocusId;
      return graph.nodes.find((n) => n.id === targetId) || graph.nodes[0];
    }

    function filterEcosystemItems(node) {
      if (!node || !Array.isArray(node.repoKeys)) return [];
      const keySet = new Set(node.repoKeys);
      return ecosystemItems.filter((r) => keySet.has(r.full_name || r.name));
    }

    let lastContextNodeId = null;

    function animateContextNumbers(panelEl) {
      if (ctxRafId) {
        cancelAnimationFrame(ctxRafId);
        ctxRafId = null;
      }
      if (root.stage3d && root.stage3d.prefersReducedMotion()) return;
      const targets = Array.from(panelEl.querySelectorAll('[data-countup]'))
        .map((el) => ({
          el,
          target: Math.max(0, Number(el.dataset.countup) || 0),
          suffix: el.dataset.suffix || ''
        }))
        .filter((item) => item.target > 0);
      if (!targets.length) return;

      const duration = 320;
      const startTs = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - startTs) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        targets.forEach(({ el, target, suffix }) => {
          const val = p >= 1 ? target : Math.round(target * eased);
          el.textContent = `${val}${suffix}`;
        });
        if (p < 1) {
          ctxRafId = requestAnimationFrame(step);
        } else {
          ctxRafId = null;
        }
      };
      ctxRafId = requestAnimationFrame(step);
    }

    function renderDynamicState() {
      const focusNode = getFocusNode();
      const exploring = state.trendingExplore;
      const activeFilter = state.trendingFilter;

      if (contextPanel) {
        const focusChanged = Boolean(focusNode && focusNode.id !== lastContextNodeId);
        if (focusNode) {
          contextPanel.style.setProperty('--ctx-accent', focusNode.color || '#38bdf8');
        }
        contextPanel.innerHTML = renderContextPanelHtml(focusNode, graph, state);

        if (focusChanged && !(root.stage3d && root.stage3d.prefersReducedMotion())) {
          contextPanel.classList.remove('is-pulsing');
          void contextPanel.offsetWidth;
          contextPanel.classList.add('is-pulsing');
          animateContextNumbers(contextPanel);
        }
        lastContextNodeId = focusNode ? focusNode.id : null;

        contextPanel.querySelectorAll('[data-jump-node]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const nextNode = graph.nodes.find((n) => n.id === btn.dataset.jumpNode);
            if (nextNode) selectNeuralNode(nextNode);
          });
        });

        const filterBtn = contextPanel.querySelector('#btn-ctx-filter');
        if (filterBtn && focusNode) {
          filterBtn.addEventListener('click', () => {
            state.trendingExplore = null;
            if (state.trendingFilter && state.trendingFilter.id === focusNode.id) {
              state.trendingFilter = null;
            } else {
              state.trendingFilter = {
                id: focusNode.id,
                label: focusNode.label,
                kind: graph.sourceKind,
                items: filterEcosystemItems(focusNode)
              };
            }
            renderDynamicState();
          });
        }

        const exploreBtn = contextPanel.querySelector('#btn-ctx-explore');
        if (exploreBtn && focusNode && handlers.onExploreNode) {
          exploreBtn.addEventListener('click', () => {
            handlers.onExploreNode(focusNode, exploreBtn);
          });
        }
      }

      if (exploreSlot) {
        if (exploring) {
          exploreSlot.innerHTML = `
            <div class="banner banner-info explore-status-bar">
              <span>Mostrando top repositorios en GitHub para <strong>${esc(exploring.label)}</strong> (${exploring.items.length})</span>
              <button type="button" class="btn btn-sm" id="btn-exit-explore">← Volver a populares</button>
            </div>
          `;
          exploreSlot.querySelector('#btn-exit-explore').addEventListener('click', () => {
            state.trendingExplore = null;
            renderDynamicState();
          });
        } else if (activeFilter) {
          const scopeTxt = activeFilter.kind === 'recent_7d'
            ? `Mostrando repositorios publicados en los últimos 7 días para <strong>${esc(activeFilter.label)}</strong> (${activeFilter.items.length})`
            : `Filtrando tendencias por <strong>${esc(activeFilter.label)}</strong> (${activeFilter.items.length})`;
          exploreSlot.innerHTML = `
            <div class="banner banner-info explore-status-bar">
              <span>${scopeTxt}</span>
              <button type="button" class="btn btn-sm" id="btn-clear-trend-filter">← Volver a populares (${trendingItems.length})</button>
            </div>
          `;
          exploreSlot.querySelector('#btn-clear-trend-filter').addEventListener('click', () => {
            state.trendingFilter = null;
            state.selectedNeuralId = null;
            renderDynamicState();
          });
        } else {
          exploreSlot.innerHTML = '';
        }
      }

      let displayItems = trendingItems;
      if (exploring) {
        displayItems = exploring.items || [];
      } else if (activeFilter && Array.isArray(activeFilter.items)) {
        displayItems = activeFilter.items;
      }

      gridEl.innerHTML = displayItems.length
        ? displayItems.map((repo, idx) => renderTrendingCardHtml(repo, idx)).join('')
        : '<p class="banner banner-info">No hubo coincidencias en esta muestra; probá <strong>Explorar top en GitHub →</strong> arriba.</p>';

      gridEl.querySelectorAll('.trending-card').forEach((card) => {
        const openModal = () => {
          const key = card.dataset.repoFull;
          const repo = displayItems.find((r) => (r.full_name || r.name) === key);
          if (repo && repo.owner && root.renderRepos) {
            root.renderRepos.openInspectorModal(repo.owner.login, repo);
          }
        };
        card.addEventListener('click', openModal);
        card.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openModal();
          }
        });
      });

      gridEl.querySelectorAll('[data-open-owner]').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const owner = btn.dataset.openOwner;
          if (owner && handlers.onOpenOwner) {
            handlers.onOpenOwner(owner);
          }
        });
      });

      if (chipsWrap) {
        const activeChipId = state.selectedNeuralId || '';
        chipsWrap.querySelectorAll('[data-cat-id]').forEach((btn) => {
          if (!btn.dataset.catId) {
            btn.classList.toggle('is-active-chip', !state.trendingFilter && !state.trendingExplore);
          } else {
            btn.classList.toggle('is-active-chip', btn.dataset.catId === activeChipId);
          }
        });
      }

      if (activeNeuralCtrl) {
        activeNeuralCtrl.setSelected(state.selectedNeuralId);
      }
    }

    function selectNeuralNode(node) {
      if (!node) {
        state.selectedNeuralId = null;
        state.trendingFilter = null;
        state.trendingExplore = null;
      } else if (state.selectedNeuralId === node.id && !state.trendingExplore) {
        state.selectedNeuralId = null;
        state.trendingFilter = null;
      } else {
        state.selectedNeuralId = node.id;
        state.trendingExplore = null;
        const matched = filterEcosystemItems(node);
        state.trendingFilter = matched.length > 0
          ? { id: node.id, label: node.label, kind: graph.sourceKind, items: matched }
          : null;
      }
      renderDynamicState();
    }

    const canvasEl = container.querySelector('#tech-neural-canvas');
    if (canvasEl && root.neuralNet) {
      const autoBtn = container.querySelector('#btn-neural-auto');

      activeNeuralCtrl = root.neuralNet.mountTechNeuralNet(canvasEl, graph, {
        selectedId: state.selectedNeuralId,
        onAutoChange: (running) => {
          if (autoBtn) autoBtn.textContent = running ? '⏸' : '↻';
        },
        onHoverNode: (node) => {
          if (!hudText) return;
          if (node) {
            hudText.innerHTML = formatHoverSummary(node, graph);
          } else {
            const focused = state.selectedNeuralId
              ? graph.nodes.find((n) => n.id === state.selectedNeuralId)
              : null;
            hudText.innerHTML = formatHoverSummary(focused, graph);
          }
        },
        onSelectNode: (node) => {
          selectNeuralNode(node);
        }
      });

      if (autoBtn) {
        if (root.stage3d && root.stage3d.prefersReducedMotion()) {
          autoBtn.classList.add('hidden');
        } else {
          autoBtn.addEventListener('click', () => {
            activeNeuralCtrl.toggleAuto();
          });
        }
      }

      const resetBtn = container.querySelector('#btn-neural-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => activeNeuralCtrl.reset());
      }
    }

    container.querySelectorAll('[data-trending-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (handlers.onRangeChange) handlers.onRangeChange(btn.dataset.trendingRange);
      });
    });

    if (chipsWrap) {
      chipsWrap.querySelectorAll('[data-cat-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.catId;
          if (!id) {
            selectNeuralNode(null);
            return;
          }
          const node = graph.nodes.find((n) => n.id === id);
          selectNeuralNode(node || null);
        });
      });
    }

    renderDynamicState();
  }

  root.renderHome = {
    renderTrendingHome,
    cleanup,
    refreshTheme
  };
})();
