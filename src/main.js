(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  const SUGGESTED_USERS = ['torvalds', 'gaearon', 'sindresorhus', 'mrdoob', 'octocat', 'vercel'];

  const dom = {};

  function cacheDom() {
    dom.goHomeBtn = document.getElementById('btn-go-home');
    dom.modeBtns = document.querySelectorAll('[data-app-mode]');
    dom.themeSelect = document.getElementById('theme-select');
    dom.quotaPill = document.getElementById('quota-pill');
    dom.quotaText = document.getElementById('quota-text');
    dom.singleForm = document.getElementById('single-search-form');
    dom.compareForm = document.getElementById('compare-search-form');
    dom.userInput = document.getElementById('user-input');
    dom.compareA = document.getElementById('compare-a');
    dom.compareB = document.getElementById('compare-b');
    dom.alertSlot = document.getElementById('alert-slot');
    dom.profileSlot = document.getElementById('profile-slot');
    dom.reposSlot = document.getElementById('repos-slot');
    dom.apiDialog = document.getElementById('api-dialog');
    dom.apiDialogBody = document.getElementById('api-dialog-body');
    dom.toast = document.getElementById('app-toast');
  }

  let toastTimer = null;
  function notify(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove('is-visible');
    }, 2600);
  }
  root.notify = notify;

  function applyTheme(theme) {
    const valid = root.cache.setTheme(theme);
    root.state.theme = valid;
    document.documentElement.setAttribute('data-theme', valid);
    if (dom.themeSelect) dom.themeSelect.value = valid;
    if (root.renderHome) root.renderHome.refreshTheme();
  }

  function updateQuotaUi(info) {
    if (!dom.quotaPill || !dom.quotaText) return;
    const limit = info.limit || (info.authenticated ? 5000 : 60);
    const rem = info.remaining !== null && info.remaining !== undefined ? info.remaining : limit;
    const authLabel = info.authenticated ? 'PAT' : 'Pública';
    dom.quotaText.textContent = `API ${authLabel}: ${rem}/${limit}`;
    dom.quotaPill.classList.remove('is-warn', 'is-crit');
    const ratio = rem / limit;
    if (ratio <= 0.15) dom.quotaPill.classList.add('is-crit');
    else if (ratio <= 0.35) dom.quotaPill.classList.add('is-warn');
  }

  function renderChips(container = document) {
    const { esc } = root.utils;
    const suggestedRow = container.querySelector('#suggested-chips');
    const historyRow = container.querySelector('#history-chips');

    if (suggestedRow) {
      suggestedRow.innerHTML =
        `<span class="chip-label">Explorar:</span>` +
        SUGGESTED_USERS.map(
          (u) => `<button type="button" class="chip-btn" data-quick-user="${esc(u)}">@${esc(u)}</button>`
        ).join('');

      suggestedRow.querySelectorAll('[data-quick-user]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const u = btn.dataset.quickUser;
          if (root.state.mode === 'compare') {
            if (!dom.compareA.value.trim()) dom.compareA.value = u;
            else dom.compareB.value = u;
          } else {
            dom.userInput.value = u;
            loadSingleProfile(u);
          }
        });
      });
    }

    if (historyRow) {
      const history = root.cache.getHistory();
      if (!history.length) {
        historyRow.innerHTML = '';
        historyRow.classList.add('hidden');
      } else {
        historyRow.classList.remove('hidden');
        historyRow.innerHTML =
          `<span class="chip-label">Recientes:</span>` +
          history.map((u) => `<button type="button" class="chip-btn" data-hist-user="${esc(u)}">@${esc(u)}</button>`).join('') +
          `<button type="button" class="chip-btn is-clear" id="btn-clear-history">Limpiar</button>`;

        historyRow.querySelectorAll('[data-hist-user]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const u = btn.dataset.histUser;
            if (root.state.mode === 'compare') {
              if (!dom.compareA.value.trim()) dom.compareA.value = u;
              else dom.compareB.value = u;
            } else {
              dom.userInput.value = u;
              loadSingleProfile(u);
            }
          });
        });

        const clearBtn = historyRow.querySelector('#btn-clear-history');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            root.cache.clearHistory();
            renderChips(container);
          });
        }
      }
    }
  }

  function showSkeletonLoading() {
    dom.alertSlot.innerHTML = '';
    dom.reposSlot.innerHTML = '';
    const heights = [150, 195, 118, 168, 92, 134];
    dom.profileSlot.innerHTML = `
      <div class="skeleton-stage" aria-live="polite" aria-label="Cargando perfil">
        <div class="skeleton-holo"></div>
        <div class="skeleton-prisms" aria-hidden="true">
          ${heights.map((h) => `<div class="skeleton-bar3" style="--sh:${h}px"></div>`).join('')}
        </div>
      </div>
    `;
  }

  function showWelcome() {
    dom.alertSlot.innerHTML = '';
    dom.reposSlot.innerHTML = '';
    dom.profileSlot.innerHTML = `
      <section class="welcome-empty">
        <h2>Explorá cualquier perfil u organización de GitHub</h2>
        <p>Escribí un usuario en la barra superior o elegí uno de acceso rápido para analizar su actividad y repositorios.</p>
        <div class="quick-rows" style="align-items:center;margin-top:16px">
          <div class="chip-row" id="suggested-chips" style="justify-content:center"></div>
          <div class="chip-row hidden" id="history-chips" style="justify-content:center"></div>
        </div>
        <div class="welcome-features">
          <div class="welcome-item"><strong>Skyline y Sistema Orbital</strong>Torres volumétricas y esferas orbitales con colores Linguist y modo Bytes reales.</div>
          <div class="welcome-item"><strong>Paisaje de Actividad</strong>Relieve topográfico interactivo de 70 días (o 365 días con GraphQL y PAT).</div>
          <div class="welcome-item"><strong>Inspector de Repositorios</strong>Desglose exacto de bytes, historial reciente de commits y clonado rápido.</div>
          <div class="welcome-item"><strong>Arena de Duelo</strong>Compará dos desarrolladores cara a cara, medí su afinidad y exportá tarjetas PNG/SVG.</div>
        </div>
      </section>
    `;
    renderChips(dom.profileSlot);
  }

  function showDuelWelcome() {
    dom.alertSlot.innerHTML = '';
    dom.reposSlot.innerHTML = '';
    dom.profileSlot.innerHTML = `
      <section class="welcome-empty">
        <h2>Arena de Duelo entre desarrolladores</h2>
        <p>Ingresá dos usuarios en la barra superior y presioná <strong>Duelo</strong> para comparar su impacto y afinidad tecnológica.</p>
        <div class="quick-rows" style="align-items:center;margin-top:16px">
          <div class="chip-row" id="suggested-chips" style="justify-content:center"></div>
          <div class="chip-row hidden" id="history-chips" style="justify-content:center"></div>
        </div>
      </section>
    `;
    renderChips(dom.profileSlot);
  }

  function showBanner(type, message, extraHtml = '') {
    const { esc } = root.utils;
    const cls = type === 'err' ? 'banner-err' : type === 'warn' ? 'banner-warn' : 'banner-info';
    dom.alertSlot.innerHTML = `
      <div class="banner ${cls}" role="alert">
        <span>${esc(message)}</span>
        ${extraHtml}
      </div>
    `;
  }

  function setMode(mode) {
    const next = ['home', 'single', 'compare'].includes(mode) ? mode : 'home';
    if (next !== 'home' && root.renderHome) {
      root.renderHome.cleanup();
    }
    root.state.mode = next;
    dom.modeBtns.forEach((b) => {
      const active = b.dataset.appMode === root.state.mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (root.state.mode === 'compare') {
      dom.singleForm.classList.add('hidden');
      dom.compareForm.classList.remove('hidden');
    } else {
      dom.compareForm.classList.add('hidden');
      dom.singleForm.classList.remove('hidden');
    }
  }

  function rebuildProfileModel(profile, repos, bytesMap) {
    const rebuilt = root.analytics.buildProfileModel(
      profile.user,
      repos,
      profile._rawEvents || [],
      bytesMap,
      {
        orgMembers: profile.orgMembers,
        annualCalendar: profile._annualCalendar
      }
    );
    rebuilt._rawEvents = profile._rawEvents || [];
    rebuilt._annualCalendar = profile._annualCalendar || null;
    return rebuilt;
  }

  function renderActiveProfile() {
    const profile = root.state.currentProfile;
    if (!profile) return;

    root.renderProfile.renderProfileSections(dom.profileSlot, profile, {
      onMetricChange: handleMetricChange,
      onLangViewChange: handleLangViewChange,
      onActivityRangeChange: handleActivityRangeChange,
      onSelectLanguage: handleSelectLanguage,
      onExpandBytes: handleExpandBytes,
      onExportPng: handleExportPng,
      onExportSvg: handleExportSvg,
      onCopyImage: handleCopyImage,
      onStartDuel: handleStartDuelFromProfile,
      onCopyShare: handleCopyShare
    });

    root.renderRepos.renderReposExplorer(dom.reposSlot, profile, {
      onClearLanguage: () => {
        root.state.activeLanguage = null;
        root.state.visibleRepoCount = 12;
        syncUrl();
        renderActiveProfile();
      },
      onLoadMorePages: handleLoadMorePages
    });
  }

  function syncUrl() {
    const st = root.state;
    if (st.mode === 'home') {
      root.url.syncUrlParams({});
    } else if (st.mode === 'compare' && st.duel.profileA && st.duel.profileB) {
      root.url.syncUrlParams({
        user: st.duel.profileA.user.login,
        compare: st.duel.profileB.user.login,
        mode: 'repos',
        lang: null
      });
    } else if (st.currentProfile) {
      root.url.syncUrlParams({
        user: st.currentProfile.user.login,
        compare: null,
        mode: st.languageMetric,
        lang: st.activeLanguage
      });
    }
  }

  function renderHomeView() {
    if (!root.state.trendingData || !root.renderHome) return;
    dom.reposSlot.innerHTML = '';
    root.renderHome.renderTrendingHome(
      dom.profileSlot,
      {
        trending: root.state.trendingData,
        recentPublished: root.state.recentPublishedData
      },
      root.state,
      {
        onRangeChange: (nextRange) => loadHome(nextRange),
        onExploreNode: async (node, btn) => {
          if (!node || !node.searchQuery) return;
          const prev = btn ? btn.textContent : '';
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Buscando…';
          }
          try {
            const res = await root.api.fetchCategoryRepos(node.searchQuery, node.id.replace(/[:]/g, '_'), 18);
            root.state.selectedNeuralId = node.id;
            root.state.trendingFilter = null;
            root.state.trendingExplore = {
              id: node.id,
              label: node.label,
              items: res.items,
              stale: res.stale,
              staleReason: res.staleReason
            };
            renderHomeView();
          } catch (err) {
            notify(err.message || 'No se pudo consultar GitHub para esa tecnología.');
            if (btn) {
              btn.disabled = false;
              btn.textContent = prev;
            }
          }
        },
        onOpenOwner: (owner) => {
          dom.userInput.value = owner;
          loadSingleProfile(owner);
        }
      }
    );
  }

  async function loadHome(range = root.state.trendingRange || 'week') {
    const validRange = ['week', 'month', 'all'].includes(range) ? range : 'week';
    setMode('home');
    root.state.trendingRange = validRange;
    root.state.selectedNeuralId = null;
    root.state.trendingFilter = null;
    root.state.trendingExplore = null;
    syncUrl();

    const hasTrending = root.state.trendingData && root.state.trendingData.range === validRange;
    const hasRecent = root.state.recentPublishedData !== null;

    if (hasTrending && hasRecent) {
      dom.alertSlot.innerHTML = '';
      if (root.state.trendingData.fallbackNotice) {
        showBanner('info', root.state.trendingData.fallbackNotice);
      }
      renderHomeView();
      return;
    }

    showSkeletonLoading();
    try {
      const trendingPromise = hasTrending
        ? Promise.resolve(root.state.trendingData)
        : root.api.fetchTrendingRepos({ range: validRange, perPage: 30 });

      const recentPromise = hasRecent
        ? Promise.resolve(root.state.recentPublishedData)
        : root.api.fetchRecentPublishedRepos({ days: 7, pages: 2, perPage: 100 }).catch(() => null);

      const [trendingData, recentData] = await Promise.all([trendingPromise, recentPromise]);
      root.state.trendingData = trendingData;
      if (!hasRecent) {
        root.state.recentPublishedData = recentData;
      }

      if (trendingData.stale) {
        showBanner('warn', trendingData.staleReason || 'Mostrando tendencias guardadas en caché.');
      } else if (trendingData.fallbackNotice) {
        showBanner('info', trendingData.fallbackNotice);
      } else {
        dom.alertSlot.innerHTML = '';
      }
      renderHomeView();
    } catch (err) {
      dom.profileSlot.innerHTML = '';
      dom.reposSlot.innerHTML = '';
      showBanner('err', err.message || 'No se pudieron cargar los repositorios populares.');
    }
  }

  async function runBytesAnalysis(profile, incrementOnly = false) {
    if (!profile || !profile.ownRepos.length) return;
    if (!incrementOnly && Object.keys(profile.bytesMap).length > 0) return;

    const sortedTargets = [...profile.ownRepos]
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0) || (b.size || 0) - (a.size || 0));

    const hasToken = Boolean(root.cache.getToken());
    const stepLimit = hasToken ? (incrementOnly ? 20 : 30) : 12;
    const pendingCount = sortedTargets.filter((r) => !profile.bytesMap[r.name]).length;
    const targetBatchSize = Math.min(stepLimit, pendingCount);
    if (targetBatchSize === 0) return;

    const rl = root.api.getRateLimit();
    if (!hasToken && rl.remaining !== null && rl.remaining < 4) {
      notify('Cuota muy baja para consultar bytes de múltiples repos; usando caché disponible.');
    }

    root.state.bytesProgress = { done: 0, total: targetBatchSize };
    renderActiveProfile();

    const batch = await root.api.fetchBatchLanguages(profile.user.login, sortedTargets, {
      existingMap: profile.bytesMap,
      limit: stepLimit,
      concurrency: 4,
      onProgress: (done, total) => {
        root.state.bytesProgress = { done, total };
        const fill = dom.profileSlot.querySelector('.progress-fill');
        if (fill) {
          fill.style.width = Math.round((done / Math.max(1, total)) * 100) + '%';
        }
      }
    });

    root.state.bytesProgress = null;
    if (batch.rateLimited) {
      notify('Se alcanzó el límite de API a mitad del análisis en bytes; mostrando resultados parciales.');
    }

    root.state.currentProfile = rebuildProfileModel(profile, profile.repos, batch.bytesMap);
    renderActiveProfile();
  }

  async function handleMetricChange(nextMetric) {
    if (root.state.languageMetric === nextMetric) return;
    root.state.languageMetric = nextMetric;
    syncUrl();
    if (nextMetric === 'bytes' && root.state.currentProfile && !root.state.currentProfile.languagesByBytes.length) {
      await runBytesAnalysis(root.state.currentProfile, false);
    } else {
      renderActiveProfile();
    }
  }

  function handleLangViewChange(nextView) {
    if (root.state.languageView === nextView) return;
    root.state.languageView = nextView === 'orbital' ? 'orbital' : 'skyline';
    renderActiveProfile();
  }

  function handleActivityRangeChange(nextRange) {
    if (root.state.activityRange === nextRange) return;
    root.state.activityRange = nextRange === '365d' ? '365d' : '70d';
    renderActiveProfile();
  }

  async function handleExpandBytes() {
    if (!root.state.currentProfile) return;
    await runBytesAnalysis(root.state.currentProfile, true);
  }

  function handleSelectLanguage(lang) {
    root.state.activeLanguage = root.state.activeLanguage === lang ? null : lang;
    root.state.visibleRepoCount = 12;
    syncUrl();
    renderActiveProfile();
    if (root.state.activeLanguage) {
      const target = dom.reposSlot.querySelector('.explorer-bar');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  async function handleLoadMorePages(btn) {
    const profile = root.state.currentProfile;
    const pag = root.state.currentReposPagination;
    if (!profile || !pag || !pag.hasMore) return;

    btn.disabled = true;
    btn.textContent = 'Cargando más repos…';
    try {
      const nextBatch = await root.api.fetchRepos(profile.user.login, pag.nextPage, 3);
      const existingIds = new Set(profile.repos.map((r) => r.id));
      const merged = [...profile.repos];
      nextBatch.repos.forEach((r) => {
        if (!existingIds.has(r.id)) merged.push(r);
      });

      root.state.currentReposPagination = {
        hasMore: nextBatch.hasMore,
        nextPage: nextBatch.nextPage
      };

      root.state.currentProfile = rebuildProfileModel(profile, merged, profile.bytesMap);
      renderActiveProfile();
      notify(`Se cargaron ${merged.length} repositorios en total.`);
    } catch (err) {
      notify(err.message || 'No se pudieron cargar más páginas.');
      btn.disabled = false;
    }
  }

  async function handleExportPng(btn) {
    const profile = root.state.currentProfile;
    if (!profile) return;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generando PNG…';
    try {
      const ok = await root.exporter.exportProfilePng(profile, root.state.languageMetric);
      notify(ok ? 'Tarjeta descargada en PNG.' : 'No se pudo exportar la imagen.');
    } catch {
      notify('Error al generar la tarjeta PNG.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  function handleExportSvg() {
    const profile = root.state.currentProfile;
    if (!profile) return;
    try {
      root.exporter.exportProfileSvg(profile, root.state.languageMetric);
      notify('Tarjeta vectorial SVG descargada.');
    } catch {
      notify('Error al generar el SVG.');
    }
  }

  async function handleCopyImage(btn) {
    const profile = root.state.currentProfile;
    if (!profile) return;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Copiando…';
    try {
      const res = await root.exporter.copyProfileImage(profile, root.state.languageMetric);
      notify(res.ok ? 'Imagen copiada al portapapeles.' : res.reason);
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  async function handleExportDuelPng(duel, btn) {
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generando PNG…';
    try {
      const ok = await root.exporter.exportDuelPng(duel);
      notify(ok ? 'Tarjeta de duelo descargada en PNG.' : 'No se pudo generar la imagen.');
    } catch {
      notify('Error al exportar la tarjeta de duelo.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  function handleStartDuelFromProfile(login) {
    setMode('compare');
    showDuelWelcome();
    dom.compareA.value = login;
    dom.compareB.value = '';
    dom.compareB.focus();
  }

  async function handleCopyShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('Enlace copiado al portapapeles.');
    } catch {
      notify('Copiá la dirección desde la barra del navegador.');
    }
  }

  async function loadSingleProfile(username, initialOptions = {}) {
    const clean = String(username || '').trim().replace(/^@/, '');
    if (!clean) return;

    setMode('single');
    dom.userInput.value = clean;
    root.state.activeLanguage = initialOptions.lang || null;
    root.state.visibleRepoCount = 12;
    root.state.filters.query = '';
    root.state.bytesProgress = null;
    if (initialOptions.mode) {
      root.state.languageMetric = initialOptions.mode;
    }

    showSkeletonLoading();

    try {
      const [userRes, reposRes, events, annualCalendar] = await Promise.all([
        root.api.fetchUser(clean),
        root.api.fetchRepos(clean, 1, 3),
        root.api.fetchUserEvents(clean),
        root.api.fetchGraphQLContributions(clean)
      ]);

      let orgMembers = [];
      if (userRes.data && userRes.data.type === 'Organization') {
        orgMembers = await root.api.fetchOrgMembers(clean);
      }

      const model = root.analytics.buildProfileModel(userRes.data, reposRes.repos, events, {}, {
        orgMembers,
        annualCalendar
      });
      model._rawEvents = events;
      model._annualCalendar = annualCalendar;

      root.state.currentProfile = model;
      root.state.currentReposPagination = {
        hasMore: reposRes.hasMore,
        nextPage: reposRes.nextPage
      };

      root.cache.pushHistory(model.user.login);
      renderChips();

      if (userRes.stale || reposRes.stale) {
        showBanner('warn', userRes.staleReason || reposRes.staleReason || 'Mostrando datos guardados en caché.');
      } else {
        dom.alertSlot.innerHTML = '';
      }

      syncUrl();
      renderActiveProfile();

      if (root.state.languageMetric === 'bytes') {
        await runBytesAnalysis(model, false);
      }
    } catch (err) {
      dom.profileSlot.innerHTML = '';
      dom.reposSlot.innerHTML = '';
      const patBtn = err.status === 403
        ? `<button type="button" class="btn btn-sm" id="btn-open-pat-err">Configurar Token / Caché</button>`
        : '';
      showBanner('err', err.message || 'Ocurrió un error al consultar GitHub.', patBtn);
      const errPatBtn = dom.alertSlot.querySelector('#btn-open-pat-err');
      if (errPatBtn) errPatBtn.addEventListener('click', openApiDialog);
    }
  }

  async function loadDuel(userA, userB) {
    const cleanA = String(userA || '').trim().replace(/^@/, '');
    const cleanB = String(userB || '').trim().replace(/^@/, '');
    if (!cleanA || !cleanB) return;

    setMode('compare');
    dom.compareA.value = cleanA;
    dom.compareB.value = cleanB;
    showSkeletonLoading();

    try {
      const [resA, resB] = await Promise.all([
        Promise.all([root.api.fetchUser(cleanA), root.api.fetchRepos(cleanA, 1, 2), root.api.fetchUserEvents(cleanA)]),
        Promise.all([root.api.fetchUser(cleanB), root.api.fetchRepos(cleanB, 1, 2), root.api.fetchUserEvents(cleanB)])
      ]);

      const profA = root.analytics.buildProfileModel(resA[0].data, resA[1].repos, resA[2], {});
      const profB = root.analytics.buildProfileModel(resB[0].data, resB[1].repos, resB[2], {});
      const duel = root.analytics.buildDuelModel(profA, profB);

      root.state.duel = { profileA: profA, profileB: profB };
      root.cache.pushHistory(profA.user.login);
      root.cache.pushHistory(profB.user.login);
      renderChips();

      if (resA[0].stale || resB[0].stale || resA[1].stale || resB[1].stale) {
        showBanner('warn', 'Parte del duelo se mostró desde caché local por límite de API o conexión.');
      } else {
        dom.alertSlot.innerHTML = '';
      }

      syncUrl();
      dom.reposSlot.innerHTML = '';
      root.renderCompare.renderDuelArena(
        dom.profileSlot,
        duel,
        (selectedUser) => loadSingleProfile(selectedUser, { mode: 'repos' }),
        handleExportDuelPng
      );
    } catch (err) {
      dom.profileSlot.innerHTML = '';
      dom.reposSlot.innerHTML = '';
      showBanner('err', err.message || 'No se pudo completar el duelo entre esos perfiles.');
    }
  }

  function openApiDialog() {
    if (!dom.apiDialog || !dom.apiDialogBody) return;
    const rl = root.api.getRateLimit();
    const currentToken = root.cache.getToken();
    const persistence = root.cache.getTokenPersistence();
    const resetLabel = rl.resetAt ? root.api.formatResetTime(rl.resetAt) : '—';

    dom.apiDialogBody.innerHTML = `
      <div class="pat-card">
        <div class="capsule-head">
          <div>
            <h3>Estado de API, Caché y Token (PAT)</h3>
            <small style="color:var(--text-muted)">Optimizado con validación condicional ETag (304 sin gasto de cuota)</small>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-close-api">✕ Cerrar</button>
        </div>

        <div class="pat-stats-grid">
          <div class="pat-stat"><small>Consultas restantes</small><strong>${rl.remaining ?? rl.limit} / ${rl.limit}</strong></div>
          <div class="pat-stat"><small>Autenticación</small><strong>${rl.authenticated ? 'PAT activo' : 'Anónima'}</strong></div>
          <div class="pat-stat"><small>Reinicio ventana</small><strong>${resetLabel}</strong></div>
        </div>

        <p>
          Podés pegar opcionalmente un <strong>Personal Access Token</strong> de solo lectura pública para elevar el límite de
          <strong>60 a 5.000 consultas/hora</strong> y habilitar el calendario anual de <strong>365 días vía GraphQL</strong>. Nunca se envía fuera de <code>api.github.com</code>.
        </p>

        <input id="pat-input" class="field-plain" type="password" style="width:100%" placeholder="${currentToken ? 'Token configurado (pegá uno nuevo para reemplazar)' : 'ghp_... o github_pat_...'}" autocomplete="off">

        <label class="check-pill" style="margin-top:10px">
          <input type="checkbox" id="pat-remember" ${persistence === 'local' ? 'checked' : ''}>
          Recordar en este navegador (localStorage) · si no, solo en esta sesión
        </label>

        <div class="pat-actions">
          <button type="button" class="btn btn-primary btn-sm" id="btn-save-pat">Guardar Token</button>
          ${currentToken ? `<button type="button" class="btn btn-sm" id="btn-remove-pat">Borrar Token</button>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" id="btn-clear-cache">Vaciar caché local</button>
        </div>
      </div>
    `;

    dom.apiDialogBody.querySelector('#btn-close-api').addEventListener('click', () => dom.apiDialog.close());

    dom.apiDialogBody.querySelector('#btn-save-pat').addEventListener('click', async () => {
      const val = dom.apiDialogBody.querySelector('#pat-input').value.trim();
      const persist = dom.apiDialogBody.querySelector('#pat-remember').checked;
      if (!val) {
        notify('Ingresá un token válido o cerrá la ventana.');
        return;
      }
      root.cache.setToken(val, persist);
      await root.api.refreshRateLimit();
      notify('Token guardado y cuota actualizada.');
      dom.apiDialog.close();
      if (root.state.mode === 'single' && root.state.currentProfile) {
        loadSingleProfile(root.state.currentProfile.user.login);
      }
    });

    const removeBtn = dom.apiDialogBody.querySelector('#btn-remove-pat');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        root.cache.clearToken();
        await root.api.refreshRateLimit();
        notify('Token eliminado. Modo anónimo restaurado.');
        dom.apiDialog.close();
      });
    }

    dom.apiDialogBody.querySelector('#btn-clear-cache').addEventListener('click', () => {
      root.cache.clearApiCache();
      notify('Caché local vaciada.');
    });

    if (typeof dom.apiDialog.showModal === 'function') {
      dom.apiDialog.showModal();
    } else {
      dom.apiDialog.setAttribute('open', 'open');
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Silent fallback if SW registration is unavailable in environment.
      });
    }
  }

  function bindGlobalEvents() {
    if (dom.goHomeBtn) {
      dom.goHomeBtn.addEventListener('click', () => loadHome());
    }

    dom.modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextMode = btn.dataset.appMode;
        if (nextMode === 'home') {
          loadHome();
          return;
        }
        if (nextMode === 'single') {
          setMode('single');
          if (root.state.currentProfile) {
            dom.alertSlot.innerHTML = '';
            syncUrl();
            renderActiveProfile();
          } else {
            showWelcome();
            dom.userInput.focus();
          }
          return;
        }
        setMode(nextMode);
        if (nextMode === 'compare') {
          if (root.state.currentProfile && !dom.compareA.value.trim()) {
            dom.compareA.value = root.state.currentProfile.user.login;
          }
          if (root.state.duel.profileA && root.state.duel.profileB) {
            const duel = root.analytics.buildDuelModel(root.state.duel.profileA, root.state.duel.profileB);
            dom.reposSlot.innerHTML = '';
            dom.alertSlot.innerHTML = '';
            syncUrl();
            root.renderCompare.renderDuelArena(
              dom.profileSlot,
              duel,
              (selectedUser) => loadSingleProfile(selectedUser, { mode: 'repos' }),
              handleExportDuelPng
            );
          } else {
            showDuelWelcome();
            dom.compareA.focus();
          }
        }
      });
    });

    if (dom.themeSelect) {
      dom.themeSelect.addEventListener('change', (ev) => {
        applyTheme(ev.target.value);
      });
    }

    dom.singleForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      loadSingleProfile(dom.userInput.value);
    });

    dom.compareForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      loadDuel(dom.compareA.value, dom.compareB.value);
    });

    if (dom.quotaPill) {
      dom.quotaPill.addEventListener('click', openApiDialog);
    }

    [document.getElementById('repo-dialog'), dom.apiDialog].forEach((dlg) => {
      if (!dlg) return;
      dlg.addEventListener('click', (ev) => {
        if (ev.target === dlg) dlg.close();
      });
    });
  }

  function init() {
    cacheDom();
    applyTheme(root.cache.getTheme());
    root.api.setRateLimitListener(updateQuotaUi);
    updateQuotaUi({
      limit: root.cache.getToken() ? 5000 : 60,
      remaining: null,
      authenticated: Boolean(root.cache.getToken())
    });

    bindGlobalEvents();
    renderChips();
    registerServiceWorker();

    const initial = root.url.readUrlParams();
    if (initial.user && initial.compare) {
      loadDuel(initial.user, initial.compare);
    } else if (initial.user) {
      loadSingleProfile(initial.user, { mode: initial.mode, lang: initial.lang });
    } else {
      loadHome('week');
    }

    root.api.refreshRateLimit();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
