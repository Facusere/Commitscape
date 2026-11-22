(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  function renderPrismHtml(item, maxVal, index, isBytes, activeLang) {
    const height = Math.round(42 + (item.value / (maxVal || 1)) * 175);
    const valLabel = isBytes ? item.pct.toFixed(1) + '%' : String(item.value);
    const isSelected = activeLang && activeLang === item.name;
    const isDimmed = activeLang && activeLang !== item.name;
    const classes = [
      'prism-slot',
      isSelected ? 'is-selected' : '',
      isDimmed ? 'is-dimmed' : ''
    ].filter(Boolean).join(' ');

    const { esc, formatBytes } = root.utils;
    const titleInfo = isBytes
      ? `${item.name}: ${item.pct.toFixed(1)}% (${formatBytes(item.value)})`
      : `${item.name}: ${item.value} repos propios (${item.pct.toFixed(1)}%)`;

    return `
      <button type="button"
        class="${classes}"
        data-lang="${esc(item.name)}"
        style="--h:${height}px;--prism-color:${esc(item.color)};--delay:${(index * 0.1).toFixed(2)}s"
        aria-pressed="${isSelected ? 'true' : 'false'}"
        title="${esc(titleInfo)} — Clic para filtrar repositorios">
        <span class="prism-val">${esc(valLabel)}</span>
        <span class="prism-body" aria-hidden="true">
          <span class="prism-face prism-front"></span>
          <span class="prism-face prism-back"></span>
          <span class="prism-face prism-right"></span>
          <span class="prism-face prism-left"></span>
          <span class="prism-face prism-top"></span>
        </span>
        <span class="prism-glow" aria-hidden="true"></span>
        <span class="prism-lbl">${esc(item.name)}</span>
      </button>
    `;
  }

  let orbitalRafId = null;

  function stopOrbitalMotion() {
    if (orbitalRafId) {
      cancelAnimationFrame(orbitalRafId);
      orbitalRafId = null;
    }
  }

  function renderOrbitalHtml(list, maxVal, isBytes, activeLang) {
    const { esc, formatBytes, formatNumber } = root.utils;
    const layout = [
      { angle: -30, radius: 92, z: 36, speed: 0.16 },
      { angle: 150, radius: 92, z: 32, speed: 0.16 },
      { angle: 32, radius: 126, z: 28, speed: 0.11 },
      { angle: 212, radius: 126, z: 24, speed: 0.11 },
      { angle: -102, radius: 156, z: 22, speed: 0.08 },
      { angle: 78, radius: 156, z: 20, speed: 0.08 }
    ];

    const totalSum = list.reduce((sum, item) => sum + (item.value || 0), 0);
    const coreSub = isBytes ? formatBytes(totalSum) : `${formatNumber(totalSum)} repos`;

    const planets = list.map((item, idx) => {
      const slot = layout[idx % layout.length];
      const rad = (slot.angle * Math.PI) / 180;
      const px = Math.round(Math.cos(rad) * slot.radius);
      const py = Math.round(Math.sin(rad) * slot.radius * 0.72);
      const pz = Math.round(Math.sin(rad) * slot.z);
      const size = Math.round(32 + (item.value / (maxVal || 1)) * 18);
      const valLabel = isBytes ? item.pct.toFixed(1) + '%' : String(item.value);
      const isSelected = activeLang && activeLang === item.name;
      const isDimmed = activeLang && activeLang !== item.name;
      const classes = [
        'lang-planet-slot',
        isSelected ? 'is-selected' : '',
        isDimmed ? 'is-dimmed' : ''
      ].filter(Boolean).join(' ');

      const titleInfo = isBytes
        ? `${item.name}: ${item.pct.toFixed(1)}% (${formatBytes(item.value)})`
        : `${item.name}: ${item.value} repos propios (${item.pct.toFixed(1)}%)`;

      return `
        <button type="button"
          class="${classes}"
          data-lang="${esc(item.name)}"
          data-base-angle="${rad.toFixed(4)}"
          data-orbit-radius="${slot.radius}"
          data-orbit-speed="${slot.speed}"
          data-orbit-z="${slot.z}"
          style="--px:${px}px;--py:${py}px;--pz:${pz}px;--ps:${size}px;--planet-color:${esc(item.color)}"
          aria-pressed="${isSelected ? 'true' : 'false'}"
          title="${esc(titleInfo)} — Clic para filtrar repositorios">
          <span class="orbital-logo-planet" aria-hidden="true">
            ${root.colors.getLangIconHtml(item.name, idx)}
          </span>
          <span class="planet-label">${esc(item.name)} · ${esc(valLabel)}</span>
        </button>
      `;
    }).join('');

    const breakdownRows = list.map((item, idx) => {
      const isSelected = activeLang && activeLang === item.name;
      const isDimmed = activeLang && activeLang !== item.name;
      const rowCls = [
        'orbital-lang-row',
        isSelected ? 'is-selected' : '',
        isDimmed ? 'is-dimmed' : ''
      ].filter(Boolean).join(' ');
      const metricLabel = isBytes
        ? `${item.pct.toFixed(1)}% · ${formatBytes(item.value)}`
        : `${item.value} repos · ${item.pct.toFixed(1)}%`;

      return `
        <button type="button" class="${rowCls}" data-lang="${esc(item.name)}" aria-pressed="${isSelected ? 'true' : 'false'}">
          <div class="orbital-row-head">
            <span class="lang-logo-wrap">
              ${root.colors.getLangIconHtml(item.name, idx)}
              <strong>${esc(item.name)}</strong>
            </span>
            <span class="orbital-row-val">${esc(metricLabel)}</span>
          </div>
          <div class="orbital-bar-track" aria-hidden="true">
            <div class="orbital-bar-fill" style="--bar-pct:${Math.max(4, item.pct).toFixed(1)}%;--bar-color:${esc(item.color)}"></div>
          </div>
        </button>
      `;
    }).join('');

    return `
      <div class="orbital-showcase">
        <div class="orbital-lang-scene" id="orbital-lang-scene">
          <div class="orbital-lang-stage">
            <div class="lang-orbit-track" style="--orbit-size:184px;--tilt:-10deg" aria-hidden="true"></div>
            <div class="lang-orbit-track" style="--orbit-size:252px;--tilt:14deg" aria-hidden="true"></div>
            <div class="lang-orbit-track" style="--orbit-size:312px;--tilt:-6deg" aria-hidden="true"></div>
            <div class="orbital-core-sphere" aria-hidden="true">
              <strong>${list.length} LANG</strong>
              <small>${esc(coreSub)}</small>
            </div>
            ${planets}
          </div>
        </div>
        <div class="orbital-breakdown-list" aria-label="Detalle interactivo por lenguaje">
          ${breakdownRows}
        </div>
      </div>
    `;
  }

  function renderVoxelCellHtml(cell, index, isAnnual = false, heightScale = 1.35) {
    const { esc } = root.utils;
    const countVal = isAnnual ? cell.count : cell.commits;
    const reposText = !isAnnual && cell.repos && cell.repos.length
      ? cell.repos.join(', ')
      : '';
    const aria = isAnnual
      ? `${cell.label}: ${countVal} contribuciones`
      : `${cell.label}: ${countVal} eventos o commits`;
    const scaledHeight = cell.heightPx > 4 ? Math.round(cell.heightPx * heightScale) : cell.heightPx;

    return `
      <button type="button"
        class="voxel-cell"
        data-voxel-index="${index}"
        aria-label="${esc(aria)}"
        title="${esc(aria)}">
        <span class="voxel-col" style="--vh:${scaledHeight}px;--vc:${esc(cell.color)}" aria-hidden="true">
          <span class="voxel-top"></span>
          <span class="voxel-front"></span>
          <span class="voxel-back"></span>
          <span class="voxel-right"></span>
          <span class="voxel-left"></span>
        </span>
        ${reposText ? `<span class="sr-only">${esc(reposText)}</span>` : ''}
      </button>
    `;
  }

  function computeTerrainStats(cells, isAnnual) {
    let totalCount = 0;
    let activeDaysCount = 0;
    let curStreak = 0;
    let maxStreak = 0;
    let peakCell = null;
    let peakVal = 0;

    (cells || []).forEach((cell) => {
      const val = Number(isAnnual ? cell.count : cell.commits) || 0;
      totalCount += val;
      if (val > 0) {
        activeDaysCount += 1;
        curStreak += 1;
        if (curStreak > maxStreak) maxStreak = curStreak;
        if (val > peakVal) {
          peakVal = val;
          peakCell = cell;
        }
      } else {
        curStreak = 0;
      }
    });

    return {
      totalCount,
      activeDaysCount,
      totalDays: (cells || []).length,
      maxStreak,
      peakVal,
      peakLabel: peakCell ? peakCell.label : ''
    };
  }

  function renderHolocardHtml(profile) {
    const { esc, safeUrl, formatCompact, formatNumber } = root.utils;
    const u = profile.user;
    const s = profile.stats;
    const avatarUrl = safeUrl(u.avatar_url);
    const profileUrl = safeUrl(u.html_url);
    const blogUrl = safeUrl(u.blog);
    const displayName = u.name || u.login;

    const metaParts = [];
    if (u.location) metaParts.push(`<span>📍 ${esc(u.location)}</span>`);
    if (u.company) metaParts.push(`<span>🏢 ${esc(u.company)}</span>`);
    if (blogUrl) {
      metaParts.push(`<a href="${esc(blogUrl)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(u.blog)}</a>`);
    }

    const orgRowHtml = profile.isOrg && profile.orgMembers.length > 0
      ? `
        <div class="org-members-row">
          <span class="org-members-label">Miembros públicos:</span>
          ${profile.orgMembers.slice(0, 8).map((m) => {
            const mAvatar = safeUrl(m.avatar_url);
            const mUrl = safeUrl(m.html_url);
            const img = `<img class="org-member-avatar" src="${esc(mAvatar)}" alt="@${esc(m.login)}" title="@${esc(m.login)}">`;
            return mUrl
              ? `<a href="${esc(mUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>`
              : img;
          }).join('')}
        </div>
      `
      : '';

    return `
      <section class="holocard" aria-label="Identidad del perfil">
        <div class="orbital-capsule">
          <div class="orbit-ring ring-a" aria-hidden="true"><span class="orbit-sat"></span></div>
          <div class="orbit-ring ring-b" aria-hidden="true"><span class="orbit-sat"></span></div>
          <img class="orbital-avatar" src="${esc(avatarUrl)}" alt="Avatar de ${esc(displayName)}">
        </div>

        <div class="holo-info">
          <div class="holo-name-row">
            <h2 class="holo-name">${esc(displayName)}</h2>
            ${profileUrl ? `<a class="holo-handle" href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer">@${esc(u.login)} ↗</a>` : `<span class="holo-handle">@${esc(u.login)}</span>`}
            ${profile.isOrg ? `<span class="context-submeta">Organización</span>` : ''}
          </div>
          <p class="holo-bio">${esc(u.bio || 'Sin biografía pública registrada en GitHub.')}</p>
          ${metaParts.length ? `<div class="holo-meta">${metaParts.join('')}</div>` : ''}
          ${orgRowHtml}
          <div class="holo-medallions">
            <div class="stat-block-3d" title="${formatNumber(s.publicRepos)} públicos (${s.ownReposCount} propios cargados)">
              <strong>${formatNumber(s.ownReposCount)}${s.publicRepos > s.loadedRepos ? '+' : ''}</strong>
              <span>Repos propios</span>
            </div>
            <div class="stat-block-3d" title="${formatNumber(s.followers)} seguidores">
              <strong>${formatCompact(s.followers)}</strong>
              <span>Seguidores</span>
            </div>
            <div class="stat-block-3d" title="${formatNumber(s.totalStars)} estrellas en repos propios">
              <strong>★ ${formatCompact(s.totalStars)}</strong>
              <span>Estrellas</span>
            </div>
            <div class="stat-block-3d" title="${formatNumber(s.totalForks)} forks en repos propios">
              <strong>⑂ ${formatCompact(s.totalForks)}</strong>
              <span>Forks</span>
            </div>
            <div class="stat-block-3d" title="Promedio ${s.avgStars} estrellas por repo propio">
              <strong>${s.avgStars}</strong>
              <span>★ / Repo</span>
            </div>
            <div class="stat-block-3d">
              <strong>${s.joinedYear}</strong>
              <span>Desde</span>
            </div>
          </div>
        </div>

        <div class="holo-actions">
          <button type="button" class="btn btn-primary btn-sm" id="btn-export-png">Exportar PNG</button>
          <button type="button" class="btn btn-sm" id="btn-export-svg">Exportar SVG</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-copy-img">Copiar imagen</button>
          <button type="button" class="btn btn-sm" id="btn-start-duel">Comparar perfil</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-copy-share">Copiar enlace</button>
        </div>
      </section>
    `;
  }

  function renderTrophiesHtml(trophies) {
    const { esc } = root.utils;
    return `
      <section class="section-block" aria-label="Logros y Trofeos">
        <div class="section-head">
          <h3 class="section-title">Logros y Trofeos</h3>
        </div>
        <div class="trophies-grid">
          ${trophies.map((t) => `
            <article class="trophy-3d tier-${esc(t.tier)} ${t.tier === 'locked' ? 'is-locked' : ''}">
              <div class="trophy-badge" aria-hidden="true">${esc(t.icon)}</div>
              <div class="trophy-copy">
                <strong>${esc(t.title)} · ${t.tier === 'locked' ? 'Por desbloquear' : esc(t.tier.toUpperCase())}</strong>
                <small>${esc(t.detail)}</small>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderVisualDuoHtml(profile, state) {
    const { esc, formatNumber } = root.utils;
    const isBytes = state.languageMetric === 'bytes';
    const hasBytesData = profile.languagesByBytes.length > 0;
    const list = (isBytes && hasBytesData ? profile.languagesByBytes : profile.languagesByRepo).slice(0, 6);
    const maxVal = list[0] ? list[0].value : 1;

    const progressHtml = state.bytesProgress
      ? `<div class="progress-strip" aria-label="Analizando lenguajes en bytes">
           <div class="progress-fill" style="width:${Math.round((state.bytesProgress.done / Math.max(1, state.bytesProgress.total)) * 100)}%"></div>
         </div>`
      : '';

    const langVisualHtml = list.length
      ? renderOrbitalHtml(list, maxVal, isBytes && hasBytesData, state.activeLanguage)
      : '<p class="scene-hint">Sin lenguajes principales detectados en repositorios propios.</p>';

    const canExpandBytes = isBytes && profile.unanalyzedOwnCount > 0 && !state.bytesProgress;
    const nextStep = Math.min(root.cache.getToken() ? 20 : 12, profile.unanalyzedOwnCount);

    const hasAnnual = Boolean(profile.annualActivity);
    const showAnnual = hasAnnual && state.activityRange === '365d';
    const activeCells = showAnnual ? profile.annualActivity.cells : profile.activityMatrix;
    const terrainStats = computeTerrainStats(activeCells, showAnnual);

    const peakSummary = terrainStats.peakVal > 0
      ? `${formatNumber(terrainStats.peakVal)} (${terrainStats.peakLabel})`
      : 'Sin picos';

    const terrainCellsHtml = showAnnual
      ? `
        <div class="terrain-plate is-annual" style="--weeks:${profile.annualActivity.weeksCount}">
          ${profile.annualActivity.cells.map((cell, idx) => renderVoxelCellHtml(cell, idx, true, 1.35)).join('')}
        </div>
      `
      : `
        <div class="terrain-plate">
          ${profile.activityMatrix.map((cell, idx) => renderVoxelCellHtml(cell, idx, false, 1.35)).join('')}
        </div>
      `;

    const defaultHudText = showAnnual
      ? `Pasá o tocá un bloque para ver contribuciones diarias (${formatNumber(profile.annualActivity.totalContributions)} este año)`
      : `Pasá o tocá un bloque para inspeccionar su actividad (${profile.totalRecentActivity} eventos/pushes en 70d)`;

    return `
      <section class="section-block profile-stack" aria-label="Lenguajes y Paisaje de Actividad">
        <article class="scene-card">
          <div class="section-head">
            <h3 class="section-title">Sistema Orbital de Lenguajes</h3>
            <div class="stage-toolbar">
              <div class="segmented" role="group" aria-label="Métrica de lenguajes">
                <button type="button" class="seg-btn ${!isBytes ? 'is-active' : ''}" data-metric="repos">Por Repos</button>
                <button type="button" class="seg-btn ${isBytes ? 'is-active' : ''}" data-metric="bytes">Por Bytes</button>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-orbital-auto" title="Pausar o reanudar órbita">⏸</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-skyline-reset" title="Restablecer vista">⌖</button>
            </div>
          </div>
          ${progressHtml}
          ${langVisualHtml}
          <div class="scene-hint">
            <span>Arrastrá para rotar · Clic en un lenguaje para filtrar repositorios</span>
            <span>
              ${hasBytesData ? `Analizados: ${Object.keys(profile.bytesMap).length}/${profile.ownRepos.length} repos` : 'Colores GitHub Linguist'}
              ${canExpandBytes ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-more-bytes" style="margin-left:8px">Analizar +${nextStep} repos</button>` : ''}
            </span>
          </div>
        </article>

        <article class="scene-card">
          <div class="section-head">
            <h3 class="section-title">Paisaje de Actividad</h3>
            <div class="stage-toolbar">
              ${hasAnnual ? `
                <div class="segmented" role="group" aria-label="Rango de actividad">
                  <button type="button" class="seg-btn ${!showAnnual ? 'is-active' : ''}" data-activity-range="70d">70 días</button>
                  <button type="button" class="seg-btn ${showAnnual ? 'is-active' : ''}" data-activity-range="365d">365 días</button>
                </div>
              ` : ''}
              <button type="button" class="btn btn-ghost btn-sm" id="btn-terrain-reset" title="Restablecer vista">⌖</button>
            </div>
          </div>

          <div class="terrain-kpi-strip" aria-label="Resumen del período de actividad">
            <div class="terrain-kpi"><span>Actividad total</span><strong>${formatNumber(terrainStats.totalCount)}</strong></div>
            <div class="terrain-kpi"><span>Días activos</span><strong>${terrainStats.activeDaysCount}/${terrainStats.totalDays}</strong></div>
            <div class="terrain-kpi"><span>Racha máxima</span><strong>${terrainStats.maxStreak} días</strong></div>
            <div class="terrain-kpi"><span>Pico diario</span><strong>${esc(peakSummary)}</strong></div>
          </div>

          <div class="terrain-scene is-amplified" id="terrain-scene">
            ${terrainCellsHtml}
          </div>
          <div class="terrain-hud" id="terrain-hud">
            <span>${esc(defaultHudText)}</span>
            <span class="terrain-legend" aria-hidden="true">
              Menos
              ${root.analytics.VOXEL_PALETTE.map((c) => `<i class="legend-dot" style="background:${c}"></i>`).join('')}
              Más
            </span>
          </div>
        </article>
      </section>
    `;
  }

  /** Renders Holocard, Trophies, Language Orbital System, and Amplified Activity Terrain. */
  function renderProfileSections(container, profile, handlers) {
    stopOrbitalMotion();
    const state = root.state;
    container.innerHTML =
      renderHolocardHtml(profile) +
      renderTrophiesHtml(profile.trophies) +
      renderVisualDuoHtml(profile, state);

    const orbitalScene = container.querySelector('#orbital-lang-scene');
    const langOrbit = root.stage3d.bindOrbitStage(orbitalScene, {
      defaultRx: -14,
      defaultRy: 12,
      minRx: -35,
      maxRx: 25,
      minRy: -55,
      maxRy: 55,
      autoRotate: false
    });

    const reducedMotion = root.stage3d && root.stage3d.prefersReducedMotion();
    let orbitalAuto = !reducedMotion;
    let orbitalHoverPaused = false;
    let orbitalClock = 0;
    let lastOrbitalTs = performance.now();

    if (orbitalScene && !reducedMotion) {
      const planetSlots = Array.from(orbitalScene.querySelectorAll('.lang-planet-slot'));
      orbitalScene.addEventListener('pointerenter', () => {
        orbitalHoverPaused = true;
      });
      orbitalScene.addEventListener('pointerleave', () => {
        orbitalHoverPaused = false;
        lastOrbitalTs = performance.now();
      });

      const stepOrbit = (now) => {
        if (!orbitalScene.isConnected) {
          orbitalRafId = null;
          return;
        }
        const dt = Math.min(0.05, Math.max(0, (now - lastOrbitalTs) / 1000));
        lastOrbitalTs = now;
        if (orbitalAuto && !orbitalHoverPaused && !orbitalScene.classList.contains('is-dragging')) {
          orbitalClock += dt;
          planetSlots.forEach((slot) => {
            const base = Number(slot.dataset.baseAngle) || 0;
            const radius = Number(slot.dataset.orbitRadius) || 90;
            const speed = Number(slot.dataset.orbitSpeed) || 0.2;
            const zAmp = Number(slot.dataset.orbitZ) || 24;
            const angle = base + orbitalClock * speed;
            const px = Math.round(Math.cos(angle) * radius);
            const py = Math.round(Math.sin(angle) * radius * 0.72);
            const pz = Math.round(Math.sin(angle) * zAmp);
            slot.style.setProperty('--px', `${px}px`);
            slot.style.setProperty('--py', `${py}px`);
            slot.style.setProperty('--pz', `${pz}px`);
          });
        }
        orbitalRafId = requestAnimationFrame(stepOrbit);
      };
      orbitalRafId = requestAnimationFrame(stepOrbit);
    }

    const terrainScene = container.querySelector('#terrain-scene');
    const terrainOrbit = root.stage3d.bindOrbitStage(terrainScene, {
      defaultRx: 52,
      defaultRy: -30,
      minRx: 24,
      maxRx: 75,
      minRy: -75,
      maxRy: 45,
      invertY: true,
      autoRotate: false
    });

    const autoBtn = container.querySelector('#btn-orbital-auto');
    if (autoBtn) {
      if (reducedMotion || !orbitalScene) {
        autoBtn.classList.add('hidden');
      } else {
        autoBtn.addEventListener('click', () => {
          orbitalAuto = !orbitalAuto;
          lastOrbitalTs = performance.now();
          autoBtn.textContent = orbitalAuto ? '⏸' : '↻';
        });
      }
    }

    const resetSkyBtn = container.querySelector('#btn-skyline-reset');
    if (resetSkyBtn && langOrbit) {
      resetSkyBtn.addEventListener('click', () => langOrbit.reset());
    }

    const resetTerrBtn = container.querySelector('#btn-terrain-reset');
    if (resetTerrBtn && terrainOrbit) {
      resetTerrBtn.addEventListener('click', () => terrainOrbit.reset());
    }

    container.querySelectorAll('[data-metric]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (handlers.onMetricChange) handlers.onMetricChange(btn.dataset.metric);
      });
    });

    container.querySelectorAll('[data-activity-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (handlers.onActivityRangeChange) handlers.onActivityRangeChange(btn.dataset.activityRange);
      });
    });

    container.querySelectorAll('.lang-planet-slot').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (orbitalScene && orbitalScene.dataset.justDragged) return;
        if (handlers.onSelectLanguage) handlers.onSelectLanguage(btn.dataset.lang);
      });
    });

    container.querySelectorAll('.orbital-lang-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (handlers.onSelectLanguage) handlers.onSelectLanguage(btn.dataset.lang);
      });
    });

    const moreBytesBtn = container.querySelector('#btn-more-bytes');
    if (moreBytesBtn && handlers.onExpandBytes) {
      moreBytesBtn.addEventListener('click', () => handlers.onExpandBytes(moreBytesBtn));
    }

    const terrainHud = container.querySelector('#terrain-hud');
    const isAnnual = Boolean(profile.annualActivity && state.activityRange === '365d');
    container.querySelectorAll('.voxel-cell').forEach((cellBtn) => {
      const updateHud = () => {
        const idx = Number(cellBtn.dataset.voxelIndex);
        const cell = isAnnual ? profile.annualActivity.cells[idx] : profile.activityMatrix[idx];
        if (!cell || !terrainHud) return;
        const { esc } = root.utils;
        if (isAnnual) {
          terrainHud.innerHTML = `
            <span><strong>${esc(cell.label)}</strong> · ${cell.count} contribuciones</span>
            <span class="terrain-legend">Nivel ${cell.level}/4</span>
          `;
        } else {
          const reposInfo = cell.repos.length ? `en ${cell.repos.join(', ')}` : 'sin actividad pública registrada';
          terrainHud.innerHTML = `
            <span><strong>${esc(cell.label)}</strong> · ${cell.commits} commits/eventos · ${esc(reposInfo)}</span>
            <span class="terrain-legend">Nivel ${cell.level}/4</span>
          `;
        }
      };
      cellBtn.addEventListener('pointerenter', updateHud);
      cellBtn.addEventListener('focus', updateHud);
      cellBtn.addEventListener('click', updateHud);
    });

    const exportPngBtn = container.querySelector('#btn-export-png');
    if (exportPngBtn && handlers.onExportPng) {
      exportPngBtn.addEventListener('click', () => handlers.onExportPng(exportPngBtn));
    }

    const exportSvgBtn = container.querySelector('#btn-export-svg');
    if (exportSvgBtn && handlers.onExportSvg) {
      exportSvgBtn.addEventListener('click', () => handlers.onExportSvg());
    }

    const copyImgBtn = container.querySelector('#btn-copy-img');
    if (copyImgBtn && handlers.onCopyImage) {
      copyImgBtn.addEventListener('click', () => handlers.onCopyImage(copyImgBtn));
    }

    const duelBtn = container.querySelector('#btn-start-duel');
    if (duelBtn && handlers.onStartDuel) {
      duelBtn.addEventListener('click', () => handlers.onStartDuel(profile.user.login));
    }

    const shareBtn = container.querySelector('#btn-copy-share');
    if (shareBtn && handlers.onCopyShare) {
      shareBtn.addEventListener('click', () => handlers.onCopyShare());
    }
  }

  root.renderProfile = {
    renderProfileSections,
    renderPrismHtml
  };
})();
