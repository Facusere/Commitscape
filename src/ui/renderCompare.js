(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  function renderDuelPairHtml(metric, index) {
    const { esc, formatCompact } = root.utils;
    const max = Math.max(1, metric.a, metric.b);
    const hA = Math.round(32 + (metric.a / max) * 165);
    const hB = Math.round(32 + (metric.b / max) * 165);
    const delayA = (index * 0.1).toFixed(2) + 's';
    const delayB = (index * 0.1 + 0.05).toFixed(2) + 's';

    return `
      <div class="duel-pair">
        <div class="prism-slot" style="--h:${hA}px;--prism-color:#38bdf8;--delay:${delayA}" title="${esc(metric.label)} (A): ${metric.a}">
          <span class="prism-val">${esc(formatCompact(metric.a))}</span>
          <span class="prism-body" aria-hidden="true">
            <span class="prism-face prism-front"></span>
            <span class="prism-face prism-back"></span>
            <span class="prism-face prism-right"></span>
            <span class="prism-face prism-left"></span>
            <span class="prism-face prism-top"></span>
          </span>
        </div>
        <div class="prism-slot" style="--h:${hB}px;--prism-color:#f472b6;--delay:${delayB}" title="${esc(metric.label)} (B): ${metric.b}">
          <span class="prism-val">${esc(formatCompact(metric.b))}</span>
          <span class="prism-body" aria-hidden="true">
            <span class="prism-face prism-front"></span>
            <span class="prism-face prism-back"></span>
            <span class="prism-face prism-right"></span>
            <span class="prism-face prism-left"></span>
            <span class="prism-face prism-top"></span>
          </span>
        </div>
        <span class="duel-pair-lbl">${esc(metric.label)}</span>
      </div>
    `;
  }

  function renderFighterHtml(profile, side) {
    const { esc, safeUrl, formatCompact } = root.utils;
    const u = profile.user;
    const avatar = safeUrl(u.avatar_url);
    const url = safeUrl(u.html_url);
    return `
      <article class="fighter-card fighter-${side}">
        <img src="${esc(avatar)}" alt="Avatar de ${esc(u.login)}">
        <div>
          <h3 style="margin:0;font-size:1.05rem">${esc(u.name || u.login)}</h3>
          ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="font-size:0.8rem">@${esc(u.login)} ↗</a>` : `<span>@${esc(u.login)}</span>`}
          <div style="font-size:0.78rem;color:var(--text-soft);margin-top:4px">
            ${profile.stats.ownReposCount} repos · ★ ${formatCompact(profile.stats.totalStars)} · ${formatCompact(profile.stats.followers)} seg.
          </div>
        </div>
      </article>
    `;
  }

  /** Renders the Duel Arena comparing two GitHub developers side-by-side. */
  function renderDuelArena(container, duel, onOpenSingle, onExportDuelPng) {
    const { esc, formatCompact } = root.utils;
    const a = duel.profileA;
    const b = duel.profileB;

    container.innerHTML = `
      <section class="section-block" aria-label="Arena de Duelo">
        <div class="duel-fighters">
          ${renderFighterHtml(a, 'a')}
          <div class="affinity-core-wrap">
            <div class="affinity-core" title="Índice de afinidad tecnológica (lenguajes en común)">
              <div>
                <strong>${duel.affinityPct}%</strong>
                <small>Afinidad Tech</small>
              </div>
            </div>
          </div>
          ${renderFighterHtml(b, 'b')}
        </div>

        <article class="scene-card">
          <div class="section-head">
            <h3 class="section-title">
              Comparativa de Métricas
              <span class="section-badge" style="color:var(--accent-cyan)">@${esc(a.user.login)}</span>
              <span class="section-badge" style="color:var(--accent-pink);border-color:rgba(244,114,182,0.4)">@${esc(b.user.login)}</span>
            </h3>
            <div class="stage-toolbar">
              <button type="button" class="btn btn-primary btn-sm" id="btn-export-duel-png">Exportar PNG</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-duel-reset">⌖ Restablecer vista</button>
            </div>
          </div>

          <div class="skyline-scene" id="duel-skyline-scene">
            <div class="skyline-stage">
              <div class="stage-floor" aria-hidden="true"></div>
              ${duel.metrics.map((m, idx) => renderDuelPairHtml(m, idx)).join('')}
            </div>
          </div>

          <div class="scene-hint">
            <span>Arrastrá para rotar · Azul = ${esc(a.user.login)} · Magenta = ${esc(b.user.login)}</span>
          </div>
        </article>

        <div class="duel-columns">
          <div class="duel-box">
            <h4>Lenguajes compartidos (${duel.shared.length})</h4>
            <div class="repo-topics">
              ${duel.shared.length ? duel.shared.map((l) => `<span class="topic-pill">${esc(l)}</span>`).join('') : '<span style="color:var(--text-muted);font-size:0.82rem">Sin coincidencias directas</span>'}
            </div>
            <h4 style="margin-top:14px;color:var(--accent-cyan)">Exclusivos de @${esc(a.user.login)}</h4>
            <div class="repo-topics">
              ${duel.onlyA.length ? duel.onlyA.slice(0, 8).map((l) => `<span class="topic-pill">${esc(l)}</span>`).join('') : '<span style="color:var(--text-muted);font-size:0.82rem">Ninguno</span>'}
            </div>
            <h4 style="margin-top:14px;color:var(--accent-pink)">Exclusivos de @${esc(b.user.login)}</h4>
            <div class="repo-topics">
              ${duel.onlyB.length ? duel.onlyB.slice(0, 8).map((l) => `<span class="topic-pill">${esc(l)}</span>`).join('') : '<span style="color:var(--text-muted);font-size:0.82rem">Ninguno</span>'}
            </div>
          </div>

          <div class="duel-box">
            <h4 style="color:var(--accent-cyan)">Top 3 · @${esc(a.user.login)}</h4>
            ${duel.topA.map((r) => `<p style="margin:8px 0;font-size:0.82rem"><strong>${esc(r.name)}</strong> · ★ ${formatCompact(r.stargazers_count || 0)} <span style="color:var(--text-muted)">(${esc(r.language || 'Otro')})</span></p>`).join('')}
            <button type="button" class="btn btn-sm" data-inspect-user="${esc(a.user.login)}" style="margin-top:8px">Ver perfil completo →</button>
          </div>

          <div class="duel-box">
            <h4 style="color:var(--accent-pink)">Top 3 · @${esc(b.user.login)}</h4>
            ${duel.topB.map((r) => `<p style="margin:8px 0;font-size:0.82rem"><strong>${esc(r.name)}</strong> · ★ ${formatCompact(r.stargazers_count || 0)} <span style="color:var(--text-muted)">(${esc(r.language || 'Otro')})</span></p>`).join('')}
            <button type="button" class="btn btn-sm" data-inspect-user="${esc(b.user.login)}" style="margin-top:8px">Ver perfil completo →</button>
          </div>
        </div>
      </section>
    `;

    const scene = container.querySelector('#duel-skyline-scene');
    const orbit = root.stage3d.bindOrbitStage(scene, {
      defaultRx: -16,
      defaultRy: -18,
      minRx: -35,
      maxRx: 10,
      minRy: -65,
      maxRy: 65,
      autoRotate: false
    });

    const resetBtn = container.querySelector('#btn-duel-reset');
    if (resetBtn && orbit) {
      resetBtn.addEventListener('click', () => orbit.reset());
    }

    const exportBtn = container.querySelector('#btn-export-duel-png');
    if (exportBtn && onExportDuelPng) {
      exportBtn.addEventListener('click', () => onExportDuelPng(duel, exportBtn));
    }

    container.querySelectorAll('[data-inspect-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (onOpenSingle) onOpenSingle(btn.dataset.inspectUser);
      });
    });
  }

  root.renderCompare = {
    renderDuelArena
  };
})();
