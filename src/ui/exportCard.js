(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shadeHex(hex, amount) {
    const clean = (hex || '#38bdf8').replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (num & 255) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawIsoPrism(ctx, x, baseY, width, height, color, label, valText) {
    const depthX = Math.round(width * 0.34);
    const depthY = -Math.round(width * 0.22);

    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - height, width, height);

    ctx.fillStyle = shadeHex(color, -55);
    ctx.beginPath();
    ctx.moveTo(x + width, baseY - height);
    ctx.lineTo(x + width + depthX, baseY - height + depthY);
    ctx.lineTo(x + width + depthX, baseY + depthY);
    ctx.lineTo(x + width, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shadeHex(color, 45);
    ctx.beginPath();
    ctx.moveTo(x, baseY - height);
    ctx.lineTo(x + depthX, baseY - height + depthY);
    ctx.lineTo(x + width + depthX, baseY - height + depthY);
    ctx.lineTo(x + width, baseY - height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e5f3ff';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(valText, x + width / 2 + Math.round(depthX / 2), baseY - height - 16);

    if (label) {
      ctx.fillStyle = '#9cc3dd';
      ctx.font = '13px "Courier New", monospace';
      ctx.fillText(label.slice(0, 10), x + width / 2, baseY + 22);
    }
  }

  function loadCorsImage(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function renderProfileCanvas(profile, metricMode = 'repos') {
    const W = 1200;
    const H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071019');
    bg.addColorStop(0.5, '#0b1620');
    bg.addColorStop(1, '#102537');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    roundRect(ctx, 32, 32, W - 64, H - 64, 24);
    ctx.fillStyle = 'rgba(18, 40, 58, 0.76)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const avatarUrl = root.utils.safeUrl(profile.user.avatar_url);
    const img = await loadCorsImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(118, 120, 48, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img) {
      ctx.drawImage(img, 70, 72, 96, 96);
    } else {
      ctx.fillStyle = '#17334a';
      ctx.fillRect(70, 72, 96, 96);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(118, 120, 50, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#e5f3ff';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText(profile.user.name || profile.user.login, 192, 108);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('@' + profile.user.login, 192, 140);

    ctx.fillStyle = '#9cc3dd';
    ctx.font = '16px "Courier New", monospace';
    const bio = (profile.user.bio || 'Perfil de GitHub en Commitscape').slice(0, 78);
    ctx.fillText(bio, 192, 170);

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('COMMITSCAPE · REPOESCENA', W - 64, 82);
    ctx.textAlign = 'left';

    const pills = [
      ['REPOS PROPIOS', String(profile.stats.ownReposCount)],
      ['ESTRELLAS ★', root.utils.formatCompact(profile.stats.totalStars)],
      ['SEGUIDORES', root.utils.formatCompact(profile.stats.followers)],
      ['FORKS ⑂', root.utils.formatCompact(profile.stats.totalForks)],
      ['DESDE', String(profile.stats.joinedYear)]
    ];

    pills.forEach(([lbl, val], idx) => {
      const px = 70 + idx * 145;
      const py = 205;
      roundRect(ctx, px, py, 132, 66, 12);
      ctx.fillStyle = 'rgba(7, 16, 25, 0.78)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#e5f3ff';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText(val, px + 14, py + 32);
      ctx.fillStyle = '#9cc3dd';
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(lbl, px + 14, py + 52);
    });

    const useBytes = metricMode === 'bytes' && profile.languagesByBytes.length > 0;
    const langs = (useBytes ? profile.languagesByBytes : profile.languagesByRepo).slice(0, 6);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(useBytes ? 'SKYLINE DE LENGUAJES (% BYTES)' : 'SKYLINE DE LENGUAJES (REPOS)', 70, 322);

    const maxV = langs[0] ? langs[0].value : 1;
    langs.forEach((l, i) => {
      const h = Math.round(38 + (l.value / maxV) * 160);
      const valTxt = useBytes ? l.pct.toFixed(1) + '%' : String(l.value);
      drawIsoPrism(ctx, 84 + i * 102, 535, 48, h, l.color, l.name, valTxt);
    });

    roundRect(ctx, 735, 305, 400, 260, 16);
    ctx.fillStyle = 'rgba(7, 16, 25, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText('TOP REPOSITORIOS', 758, 338);

    const topRepos = [...profile.ownRepos]
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 3);

    topRepos.forEach((r, idx) => {
      const ry = 368 + idx * 64;
      ctx.fillStyle = '#e5f3ff';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillText(r.name.slice(0, 26), 758, ry);

      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'right';
      ctx.fillText('★ ' + root.utils.formatCompact(r.stargazers_count), 1112, ry);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#9cc3dd';
      ctx.font = '13px "Courier New", monospace';
      ctx.fillText((r.description || 'Sin descripción').slice(0, 40), 758, ry + 22);
    });

    return canvas;
  }

  async function exportProfilePng(profile, metricMode = 'repos') {
    const canvas = await renderProfileCanvas(profile, metricMode);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    triggerDownload(blob, `commitscape-${profile.user.login}.png`);
    return true;
  }

  async function copyProfileImage(profile, metricMode = 'repos') {
    if (!navigator.clipboard || typeof window.ClipboardItem !== 'function') {
      return { ok: false, reason: 'Tu navegador no permite copiar imágenes al portapapeles; usá Exportar PNG.' };
    }
    const canvas = await renderProfileCanvas(profile, metricMode);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return { ok: false, reason: 'No se pudo generar la imagen.' };
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'El navegador bloqueó el copiado de imagen; descargá el PNG.' };
    }
  }

  function exportProfileSvg(profile, metricMode = 'repos') {
    const { esc, formatCompact } = root.utils;
    const useBytes = metricMode === 'bytes' && profile.languagesByBytes.length > 0;
    const langs = (useBytes ? profile.languagesByBytes : profile.languagesByRepo).slice(0, 6);
    const maxV = langs[0] ? langs[0].value : 1;

    const pills = [
      ['REPOS PROPIOS', String(profile.stats.ownReposCount)],
      ['ESTRELLAS ★', formatCompact(profile.stats.totalStars)],
      ['SEGUIDORES', formatCompact(profile.stats.followers)],
      ['FORKS ⑂', formatCompact(profile.stats.totalForks)],
      ['DESDE', String(profile.stats.joinedYear)]
    ];

    const pillsSvg = pills.map(([lbl, val], idx) => {
      const px = 70 + idx * 145;
      return `
        <g transform="translate(${px}, 205)">
          <rect width="132" height="66" rx="12" fill="#071019" fill-opacity="0.82" stroke="#7dd3fc" stroke-opacity="0.28"/>
          <text x="14" y="33" fill="#e5f3ff" font-size="22" font-weight="bold">${esc(val)}</text>
          <text x="14" y="53" fill="#9cc3dd" font-size="11">${esc(lbl)}</text>
        </g>
      `;
    }).join('');

    const prismsSvg = langs.map((l, idx) => {
      const x = 84 + idx * 102;
      const baseY = 535;
      const w = 48;
      const h = Math.round(38 + (l.value / maxV) * 160);
      const dx = 16;
      const dy = -10;
      const valTxt = useBytes ? l.pct.toFixed(1) + '%' : String(l.value);
      return `
        <g>
          <rect x="${x}" y="${baseY - h}" width="${w}" height="${h}" fill="${esc(l.color)}"/>
          <polygon points="${x + w},${baseY - h} ${x + w + dx},${baseY - h + dy} ${x + w + dx},${baseY + dy} ${x + w},${baseY}" fill="${esc(l.color)}" fill-opacity="0.65"/>
          <polygon points="${x},${baseY - h} ${x + dx},${baseY - h + dy} ${x + w + dx},${baseY - h + dy} ${x + w},${baseY - h}" fill="${esc(l.color)}" stroke="#ffffff" stroke-opacity="0.35"/>
          <text x="${x + w / 2 + 8}" y="${baseY - h - 16}" fill="#e5f3ff" font-size="13" font-weight="bold" text-anchor="middle">${esc(valTxt)}</text>
          <text x="${x + w / 2}" y="${baseY + 22}" fill="#9cc3dd" font-size="13" text-anchor="middle">${esc(l.name.slice(0, 10))}</text>
        </g>
      `;
    }).join('');

    const topRepos = [...profile.ownRepos]
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 3);

    const topSvg = topRepos.map((r, idx) => {
      const y = 368 + idx * 64;
      return `
        <g>
          <text x="758" y="${y}" fill="#e5f3ff" font-size="16" font-weight="bold">${esc(r.name.slice(0, 26))}</text>
          <text x="1112" y="${y}" fill="#facc15" font-size="16" font-weight="bold" text-anchor="end">★ ${esc(formatCompact(r.stargazers_count))}</text>
          <text x="758" y="${y + 22}" fill="#9cc3dd" font-size="13">${esc((r.description || 'Sin descripción').slice(0, 40))}</text>
        </g>
      `;
    }).join('');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" font-family="'Courier New', monospace">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#071019"/>
      <stop offset="50%" stop-color="#0b1620"/>
      <stop offset="100%" stop-color="#102537"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="32" y="32" width="1136" height="566" rx="24" fill="#12283a" fill-opacity="0.78" stroke="#38bdf8" stroke-opacity="0.45" stroke-width="2"/>
  <circle cx="118" cy="120" r="48" fill="#17334a" stroke="#38bdf8" stroke-width="3"/>
  <text x="118" y="132" fill="#e5f3ff" font-size="36" font-weight="bold" text-anchor="middle">${esc((profile.user.login || 'U').slice(0, 2).toUpperCase())}</text>
  <text x="192" y="108" fill="#e5f3ff" font-size="34" font-weight="bold">${esc(profile.user.name || profile.user.login)}</text>
  <text x="192" y="140" fill="#38bdf8" font-size="20">@${esc(profile.user.login)}</text>
  <text x="192" y="170" fill="#9cc3dd" font-size="16">${esc((profile.user.bio || 'Perfil de GitHub en Commitscape').slice(0, 78))}</text>
  <text x="1136" y="82" fill="#7dd3fc" font-size="16" font-weight="bold" text-anchor="end">COMMITSCAPE · REPOESCENA</text>
  ${pillsSvg}
  <text x="70" y="322" fill="#7dd3fc" font-size="16" font-weight="bold">${esc(useBytes ? 'SKYLINE DE LENGUAJES (% BYTES)' : 'SKYLINE DE LENGUAJES (REPOS)')}</text>
  ${prismsSvg}
  <rect x="735" y="305" width="400" height="260" rx="16" fill="#071019" fill-opacity="0.75" stroke="#38bdf8" stroke-opacity="0.28"/>
  <text x="758" y="338" fill="#facc15" font-size="16" font-weight="bold">TOP REPOSITORIOS</text>
  ${topSvg}
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `commitscape-${profile.user.login}.svg`);
    return true;
  }

  /** Renders and downloads a 1200x630 Duel Arena PNG comparing both profiles. */
  async function exportDuelPng(duel) {
    const W = 1200;
    const H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071019');
    bg.addColorStop(0.5, '#0b1620');
    bg.addColorStop(1, '#1a1030');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    roundRect(ctx, 32, 32, W - 64, H - 64, 24);
    ctx.fillStyle = 'rgba(18, 40, 58, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText('ARENA DE DUELO · COMMITSCAPE', 68, 76);

    const a = duel.profileA;
    const b = duel.profileB;
    const [imgA, imgB] = await Promise.all([
      loadCorsImage(root.utils.safeUrl(a.user.avatar_url)),
      loadCorsImage(root.utils.safeUrl(b.user.avatar_url))
    ]);

    // Fighter A
    ctx.save();
    ctx.beginPath();
    ctx.arc(116, 150, 42, 0, Math.PI * 2);
    ctx.clip();
    if (imgA) ctx.drawImage(imgA, 74, 108, 84, 84);
    else { ctx.fillStyle = '#17334a'; ctx.fillRect(74, 108, 84, 84); }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(116, 150, 44, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#e5f3ff';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText('@' + a.user.login, 178, 146);
    ctx.fillStyle = '#9cc3dd';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText(`${a.stats.ownReposCount} repos · ★ ${root.utils.formatCompact(a.stats.totalStars)}`, 178, 172);

    // Affinity badge center
    ctx.beginPath();
    ctx.arc(600, 150, 48, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#e5f3ff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText(duel.affinityPct + '%', 600, 150);
    ctx.fillStyle = '#9cc3dd';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('AFINIDAD', 600, 170);

    // Fighter B
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e5f3ff';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText('@' + b.user.login, 1022, 146);
    ctx.fillStyle = '#9cc3dd';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText(`${b.stats.ownReposCount} repos · ★ ${root.utils.formatCompact(b.stats.totalStars)}`, 1022, 172);
    ctx.textAlign = 'left';

    ctx.save();
    ctx.beginPath();
    ctx.arc(1084, 150, 42, 0, Math.PI * 2);
    ctx.clip();
    if (imgB) ctx.drawImage(imgB, 1042, 108, 84, 84);
    else { ctx.fillStyle = '#17334a'; ctx.fillRect(1042, 108, 84, 84); }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(1084, 150, 44, 0, Math.PI * 2);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Paired isometric prisms
    duel.metrics.forEach((m, idx) => {
      const gx = 110 + idx * 212;
      const baseY = 500;
      const maxVal = Math.max(1, m.a, m.b);
      const hA = Math.round(30 + (m.a / maxVal) * 165);
      const hB = Math.round(30 + (m.b / maxVal) * 165);

      drawIsoPrism(ctx, gx, baseY, 34, hA, '#38bdf8', '', root.utils.formatCompact(m.a));
      drawIsoPrism(ctx, gx + 48, baseY, 34, hB, '#f472b6', '', root.utils.formatCompact(m.b));

      ctx.fillStyle = '#e5f3ff';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, gx + 44, baseY + 28);
      ctx.textAlign = 'left';
    });

    ctx.fillStyle = '#9cc3dd';
    ctx.font = '13px "Courier New", monospace';
    const sharedTxt = duel.shared.length ? 'Lenguajes en común: ' + duel.shared.slice(0, 6).join(', ') : 'Sin lenguajes compartidos directos';
    ctx.fillText(sharedTxt, 68, 568);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    triggerDownload(blob, `commitscape-${a.user.login}-vs-${b.user.login}.png`);
    return true;
  }

  root.exporter = {
    exportProfileCard: exportProfilePng,
    exportProfilePng,
    exportProfileSvg,
    copyProfileImage,
    exportDuelPng
  };
})();
