(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  function readThemePalette() {
    const cs = getComputedStyle(document.documentElement);
    const theme = document.documentElement.getAttribute('data-theme') || 'midnight';
    const isLight = theme === 'light';
    const getVar = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;

    return {
      isLight,
      textMain: getVar('--text-main', isLight ? '#0f172a' : '#e5f3ff'),
      textSoft: getVar('--text-soft', isLight ? '#334155' : '#9cc3dd'),
      textMuted: getVar('--text-muted', isLight ? '#64748b' : '#7098b5'),
      accentCyan: getVar('--accent-cyan', '#38bdf8'),
      accentPink: getVar('--accent-pink', '#f472b6'),
      pillBg: getVar('--val-pill-bg', isLight ? '#0f172a' : 'rgba(7, 16, 25, 0.92)'),
      pillText: getVar('--val-pill-text', isLight ? '#f8fafc' : '#e5f3ff'),
      pillBorder: getVar('--val-pill-border', 'rgba(255, 255, 255, 0.24)'),
      lineDim: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(125, 211, 252, 0.07)'
    };
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hexToRgba(hex, alpha) {
    const clean = (hex || '#38bdf8').replace('#', '');
    const full = clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  /**
   * Mounts a 3-layer structured neural network canvas:
   * Categories (left) -> Associated Languages (center) -> Key Stacks (right),
   * with Bezier synapses, live pulses, bounded 3D tilt, and full pathway focus.
   */
  function mountTechNeuralNet(canvas, graph, options = {}) {
    if (!canvas || !graph || !Array.isArray(graph.nodes)) {
      return {
        destroy() {},
        reset() {},
        toggleAuto() { return false; },
        setSelected() {},
        redrawTheme() {}
      };
    }

    const {
      selectedId = null,
      onHoverNode = null,
      onSelectNode = null,
      onAutoChange = null
    } = options;

    const ctx = canvas.getContext('2d');
    const reducedMotion = root.stage3d && root.stage3d.prefersReducedMotion();

    const nodeById = new Map(graph.nodes.map((n, idx) => [n.id, { node: n, idx }]));
    const topLeaderIds = new Set(
      [...graph.nodes]
        .filter((n) => n.repoCount > 0)
        .sort((a, b) => b.repoCount - a.repoCount || b.stars - a.stars)
        .slice(0, 3)
        .map((n) => n.id)
    );
    const nodeAlphaMap = new Map(graph.nodes.map((n) => [n.id, 1]));
    const edgeAlphaMap = new Map((graph.edges || []).map((e) => [e.key, 0.45]));
    const nodeFlashMap = new Map();
    const iconSprites = new Map();
    const ripples = [];
    const wavePulses = [];
    const bgParticles = Array.from({ length: 22 }, (_, i) => ({
      x: Math.sin(i * 12.9898 + 1.3) * 1.12,
      y: Math.cos(i * 78.233 + 0.7) * 0.92,
      z: Math.sin(i * 39.425 + 2.1) * 0.75,
      r: 1.0 + (i % 3) * 0.55,
      phase: i * 0.61,
      isPink: i % 4 === 0
    }));

    if (root.colors && typeof root.colors.getLangSvgDataUri === 'function' && typeof Image === 'function') {
      graph.nodes.forEach((node) => {
        const img = new Image();
        img.onload = () => {
          if (!destroyed) drawFrame();
        };
        img.src = root.colors.getLangSvgDataUri(node.id || node.label, node.color);
        iconSprites.set(node.id, img);
      });
    }

    let width = 760;
    let height = 500;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let palette = readThemePalette();

    let rotX = -0.06;
    let rotY = 0.08;
    let baseClock = 0;
    let autoRotate = !reducedMotion;
    let activeSelectedId = selectedId;
    let hoveredNodeId = null;

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startRotX = rotX;
    let startRotY = rotY;

    let lastFrameTs = performance.now();
    let pulseClock = 0;
    let rafId = null;
    let destroyed = false;
    let latestProjected = [];

    function getFocusContext() {
      const focusId = hoveredNodeId || activeSelectedId;
      const focusEntry = focusId ? nodeById.get(focusId) : null;
      if (!focusEntry) return { focusNode: null, focusNodeSet: null, focusEdgeSet: null };
      const focusNode = focusEntry.node;
      return {
        focusNode,
        focusNodeSet: new Set(focusNode.pathwayIds || [focusId]),
        focusEdgeSet: new Set(focusNode.pathwayEdgeKeys || [])
      };
    }

    function triggerSynapseWave(originId) {
      if (reducedMotion || !originId || !nodeById.has(originId)) return;
      const origin = nodeById.get(originId).node;
      const pathwayEdgeKeys = new Set(origin.pathwayEdgeKeys || []);

      wavePulses.length = 0;
      if (ripples.length > 18) ripples.splice(0, ripples.length - 12);

      ripples.push({ nodeId: origin.id, color: origin.color, progress: 0, maxMult: 2.8 });
      nodeFlashMap.set(origin.id, 1);

      const pushPulse = (edge, reverse, delay, arrivalNodeId) => {
        const srcNode = nodeById.get(edge.source) && nodeById.get(edge.source).node;
        const dstNode = nodeById.get(edge.target) && nodeById.get(edge.target).node;
        const edgeColor = (srcNode && srcNode.layer === 0 ? srcNode.color : (dstNode && dstNode.color)) || origin.color;
        wavePulses.push({
          edge,
          reverse,
          delay,
          progress: 0,
          color: edgeColor,
          arrivalNodeId,
          arrived: false
        });
      };

      const edges = graph.edges || [];
      if (origin.layer === 0) {
        const hop1Langs = new Set();
        edges.forEach((edge) => {
          if (pathwayEdgeKeys.has(edge.key) && edge.source === origin.id) {
            hop1Langs.add(edge.target);
            pushPulse(edge, false, 0, edge.target);
          }
        });
        edges.forEach((edge) => {
          if (pathwayEdgeKeys.has(edge.key) && hop1Langs.has(edge.source)) {
            pushPulse(edge, false, 0.24, edge.target);
          }
        });
      } else if (origin.layer === 1) {
        edges.forEach((edge) => {
          if (!pathwayEdgeKeys.has(edge.key)) return;
          if (edge.source === origin.id) {
            pushPulse(edge, false, 0, edge.target);
          } else if (edge.target === origin.id) {
            pushPulse(edge, true, 0, edge.source);
          }
        });
      } else {
        const hop1Langs = new Set();
        edges.forEach((edge) => {
          if (pathwayEdgeKeys.has(edge.key) && edge.target === origin.id) {
            hop1Langs.add(edge.source);
            pushPulse(edge, true, 0, edge.source);
          }
        });
        edges.forEach((edge) => {
          if (pathwayEdgeKeys.has(edge.key) && hop1Langs.has(edge.target)) {
            pushPulse(edge, true, 0.24, edge.source);
          }
        });
      }
    }

    function stepAnimations(dt) {
      const { focusNodeSet, focusEdgeSet } = getFocusContext();
      const lerpK = Math.min(1, dt * 11);

      graph.nodes.forEach((node) => {
        const target = !focusNodeSet || focusNodeSet.has(node.id) ? 1.0 : 0.22;
        const cur = nodeAlphaMap.has(node.id) ? nodeAlphaMap.get(node.id) : 1.0;
        nodeAlphaMap.set(node.id, cur + (target - cur) * lerpK);

        if (nodeFlashMap.has(node.id)) {
          const nextFlash = nodeFlashMap.get(node.id) - dt * 2.1;
          if (nextFlash <= 0.01) nodeFlashMap.delete(node.id);
          else nodeFlashMap.set(node.id, nextFlash);
        }
      });

      (graph.edges || []).forEach((edge) => {
        const target = !focusEdgeSet ? 0.45 : (focusEdgeSet.has(edge.key) ? 1.0 : 0.09);
        const cur = edgeAlphaMap.has(edge.key) ? edgeAlphaMap.get(edge.key) : 0.45;
        edgeAlphaMap.set(edge.key, cur + (target - cur) * lerpK);
      });

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        ripples[i].progress += dt / 0.65;
        if (ripples[i].progress >= 1) {
          ripples.splice(i, 1);
        }
      }

      for (let i = wavePulses.length - 1; i >= 0; i -= 1) {
        const p = wavePulses[i];
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        p.progress += dt / 0.34;
        if (p.progress >= 1 && !p.arrived) {
          p.arrived = true;
          const arrEntry = p.arrivalNodeId ? nodeById.get(p.arrivalNodeId) : null;
          if (arrEntry) {
            ripples.push({
              nodeId: arrEntry.node.id,
              color: p.color || arrEntry.node.color,
              progress: 0,
              maxMult: 2.35
            });
            nodeFlashMap.set(arrEntry.node.id, 0.95);
          }
        }
        if (p.progress >= 1.15) {
          wavePulses.splice(i, 1);
        }
      }
    }

    function notifyAuto() {
      if (typeof onAutoChange === 'function') {
        onAutoChange(autoRotate);
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(300, Math.round(rect.width || 760));
      height = Math.max(340, Math.round(rect.height || 500));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      drawFrame();
    }

    function projectNodes() {
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const isNarrow = width < 680;
      const cx = width * 0.5;
      const cy = height * 0.525;
      const scaleX = isNarrow ? width * 0.42 : width * 0.34;
      const scaleY = isNarrow ? height * 0.38 : height * 0.43;
      const fov = 3.9;

      const map = new Map();
      const projected = graph.nodes.map((node) => {
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.x * sinY + node.z * cosY;
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = node.y * sinX + z1 * cosX;

        const persp = fov / Math.max(1.1, fov + z2 * 0.65);
        const sx = cx + x1 * scaleX * persp;
        const sy = cy + y2 * scaleY * persp;
        const baseR = isNarrow ? Math.max(7, node.radius * 0.78) : node.radius;
        const r = Math.max(7, baseR * (0.82 + persp * 0.2));

        const p = { node, sx, sy, z: z2, r, persp };
        map.set(node.id, p);
        return p;
      });

      projected.sort((a, b) => b.z - a.z);
      latestProjected = projected;
      return { projected, map, isNarrow };
    }

    function drawFrame() {
      if (destroyed || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background aura
      const bgGlow = ctx.createRadialGradient(width * 0.5, height * 0.52, 18, width * 0.5, height * 0.52, width * 0.5);
      bgGlow.addColorStop(0, hexToRgba(palette.accentCyan, palette.isLight ? 0.07 : 0.1));
      bgGlow.addColorStop(0.55, hexToRgba(palette.accentPink, palette.isLight ? 0.035 : 0.055));
      bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, width, height);

      const { projected, map, isNarrow } = projectNodes();

      // Parallax depth particles
      if (!reducedMotion) {
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const cx = width * 0.5;
        const cy = height * 0.525;
        const scaleX = isNarrow ? width * 0.42 : width * 0.34;
        const scaleY = isNarrow ? height * 0.38 : height * 0.43;
        const fov = 3.9;

        ctx.save();
        bgParticles.forEach((pt) => {
          const x1 = pt.x * cosY - pt.z * sinY;
          const z1 = pt.x * sinY + pt.z * cosY;
          const y2 = pt.y * cosX - z1 * sinX;
          const z2 = pt.y * sinX + z1 * cosX;
          const persp = fov / Math.max(1.1, fov + z2 * 0.65);
          const px = cx + x1 * scaleX * persp;
          const py = cy + y2 * scaleY * persp;
          const alpha = Math.max(0.05, (0.14 + 0.12 * Math.sin(pulseClock * 1.4 + pt.phase)) * persp);
          ctx.beginPath();
          ctx.arc(px, py, pt.r * persp, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(pt.isPink ? palette.accentPink : palette.accentCyan, alpha);
          ctx.fill();
        });
        ctx.restore();
      }

      // Draw subtle layer headers aligned with column centers
      const colXs = [0, 1, 2].map((layerIdx) => {
        const col = projected.filter((p) => p.node.layer === layerIdx);
        if (!col.length) return width * (0.25 + layerIdx * 0.25);
        return col.reduce((s, p) => s + p.sx, 0) / col.length;
      });
      const headers = ['CATEGORÍAS', 'LENGUAJES', 'STACKS'];
      ctx.save();
      ctx.font = `bold ${isNarrow ? 9 : 10.5}px "Courier New", monospace`;
      ctx.fillStyle = palette.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      headers.forEach((txt, idx) => {
        ctx.fillText(txt, colXs[idx], 19);
      });
      ctx.restore();

      const { focusNodeSet, focusEdgeSet } = getFocusContext();

      function drawComet(startPt, cp1, cp2, endPt, tHead, color, headR, tailSteps, stepDelta, reverseDir, alphaBoost) {
        const dir = reverseDir ? 1 : -1;
        for (let k = tailSteps; k >= 1; k -= 1) {
          const tSeg = tHead + dir * k * stepDelta;
          if (tSeg < 0 || tSeg > 1) continue;
          const pt = cubicPoint(startPt, cp1, cp2, endPt, tSeg);
          const ratio = 1 - k / (tailSteps + 1);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(0.7, headR * (0.28 + 0.65 * ratio)), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(color, alphaBoost * ratio * 0.68);
          ctx.fill();
        }
        const headPt = cubicPoint(startPt, cp1, cp2, endPt, Math.max(0, Math.min(1, tHead)));
        ctx.beginPath();
        ctx.arc(headPt.x, headPt.y, headR * 1.9, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, alphaBoost * 0.26);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(headPt.x, headPt.y, headR, 0, Math.PI * 2);
        ctx.fillStyle = headR >= 3.2 ? '#ffffff' : hexToRgba(color, Math.min(1, alphaBoost));
        ctx.fill();
      }

      const curveGeometry = new Map();

      // Pass 1a: Curved Bezier Synapses + percentage-scaled comet trails
      (graph.edges || []).forEach((edge) => {
        const pA = map.get(edge.source);
        const pB = map.get(edge.target);
        if (!pA || !pB) return;

        const isFocused = !focusEdgeSet || focusEdgeSet.has(edge.key);
        const startPt = { x: pA.sx, y: pA.sy };
        const endPt = { x: pB.sx, y: pB.sy };
        const dx = (endPt.x - startPt.x) * 0.45;
        const cp1 = { x: startPt.x + dx, y: startPt.y };
        const cp2 = { x: endPt.x - dx, y: endPt.y };
        curveGeometry.set(edge.key, { startPt, cp1, cp2, endPt });

        const targetAlpha = !focusEdgeSet ? 0.45 : (isFocused ? 1.0 : 0.09);
        const edgeStrength = reducedMotion
          ? targetAlpha
          : (edgeAlphaMap.has(edge.key) ? edgeAlphaMap.get(edge.key) : targetAlpha);
        const activeColor = pA.node.layer === 0 ? pA.node.color : pB.node.color;

        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPt.x, endPt.y);

        if (focusEdgeSet && isFocused) {
          ctx.strokeStyle = hexToRgba(activeColor, (palette.isLight ? 0.72 : 0.78) * Math.max(0.28, edgeStrength));
          ctx.lineWidth = 0.8 + edgeStrength * (0.7 + edge.weight * 1.1);
        } else if (focusEdgeSet) {
          ctx.strokeStyle = palette.isLight
            ? `rgba(15, 23, 42, ${Math.max(0.05, edgeStrength * 0.3)})`
            : `rgba(125, 211, 252, ${Math.max(0.06, edgeStrength * 0.34)})`;
          ctx.lineWidth = 0.7 + edgeStrength * 0.5;
        } else {
          ctx.strokeStyle = palette.isLight
            ? `rgba(15, 23, 42, ${0.09 + edgeStrength * 0.16})`
            : `rgba(125, 211, 252, ${0.11 + edgeStrength * 0.22})`;
          ctx.lineWidth = 0.9 + edge.weight * 0.6;
        }
        ctx.stroke();

        if (!reducedMotion && edgeStrength > 0.22) {
          const peakShare = Math.max(pA.node.sharePct || 0, pB.node.sharePct || 0);
          const edgeTraffic = graph.sourceKind === 'recent_7d'
            ? Math.min(1, Math.max(0.12, peakShare / 20))
            : edge.weight;
          const speed = 0.2 + edgeTraffic * 0.28;
          const tBase = (pulseClock * speed + edge.phase) % 1;
          const headR = isFocused && focusEdgeSet ? 2.8 : (1.5 + edgeTraffic * 0.9);
          const alphaBoost = Math.min(1, edgeStrength * (focusEdgeSet && isFocused ? 0.98 : 0.75));

          drawComet(startPt, cp1, cp2, endPt, tBase, activeColor, headR, 5, 0.02, false, alphaBoost);
          if (edgeTraffic >= 0.42 || (focusEdgeSet && isFocused)) {
            drawComet(startPt, cp1, cp2, endPt, (tBase + 0.5) % 1, activeColor, headR * 0.85, 4, 0.018, false, alphaBoost * 0.85);
          }
        }
      });

      // Cascading Synaptic Wave Packets
      if (!reducedMotion && wavePulses.length) {
        wavePulses.forEach((pulse) => {
          if (pulse.delay > 0 || pulse.progress > 1) return;
          const geom = curveGeometry.get(pulse.edge.key);
          if (!geom) return;
          const tWave = pulse.reverse ? 1 - Math.min(1, pulse.progress) : Math.min(1, pulse.progress);
          drawComet(geom.startPt, geom.cp1, geom.cp2, geom.endPt, tWave, pulse.color, 3.6, 7, 0.024, pulse.reverse, 0.96);
        });
      }

      // Pass 1b: Spheres back-to-front + organic breathing & arrival ripples
      projected.forEach((item) => {
        const { node, sx, sy, r } = item;
        const isSelected = node.id === activeSelectedId;
        const isHovered = node.id === hoveredNodeId;
        const isRelated = !focusNodeSet || focusNodeSet.has(node.id);
        const hasWeeklyActivity = node.repoCount > 0;
        const lerpedAlpha = reducedMotion
          ? (isRelated ? 1 : 0.22)
          : (nodeAlphaMap.has(node.id) ? nodeAlphaMap.get(node.id) : 1);
        const flash = nodeFlashMap.get(node.id) || 0;
        const nodeIdx = nodeById.has(node.id) ? nodeById.get(node.id).idx : 0;
        const isLeader = topLeaderIds.has(node.id);
        const breath = !reducedMotion && (isLeader || hasWeeklyActivity)
          ? (0.5 + 0.5 * Math.sin(pulseClock * 2.3 + nodeIdx * 0.8))
          : 0;

        ctx.save();
        ctx.globalAlpha = lerpedAlpha;

        // Halo for active, breathing, or flashed nodes
        const baseHalo = isSelected || isHovered ? 2.4 : (hasWeeklyActivity ? 1.85 : 1.35);
        const haloMult = baseHalo + (isLeader ? breath * 0.35 : breath * 0.14) + flash * 0.65;
        const halo = ctx.createRadialGradient(sx, sy, r * 0.25, sx, sy, r * haloMult);
        halo.addColorStop(0, hexToRgba(node.color, Math.min(0.75, (isSelected || isHovered ? 0.48 : (hasWeeklyActivity ? 0.26 : 0.12)) + flash * 0.24)));
        halo.addColorStop(1, hexToRgba(node.color, 0));
        ctx.beginPath();
        ctx.arc(sx, sy, r * haloMult, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // Backing disc + 3D vector logo (or fallback shaded sphere while loading)
        const sprite = iconSprites.get(node.id);
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, r * 1.08, 0, Math.PI * 2);
          ctx.fillStyle = palette.isLight ? 'rgba(248, 250, 252, 0.92)' : 'rgba(7, 16, 25, 0.84)';
          ctx.fill();

          const iconSize = r * 1.52;
          const tiltX = reducedMotion ? 1 : (0.86 + 0.14 * Math.cos(pulseClock * 2.0 + nodeIdx * 0.75));
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(tiltX, 1);
          ctx.drawImage(sprite, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
          ctx.restore();
        } else {
          const sphere = ctx.createRadialGradient(sx - r * 0.32, sy - r * 0.32, r * 0.08, sx, sy, r);
          sphere.addColorStop(0, '#ffffff');
          sphere.addColorStop(0.32, node.color);
          sphere.addColorStop(1, palette.isLight ? hexToRgba(node.color, 0.86) : '#08121c');
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fillStyle = sphere;
          ctx.fill();
        }

        if (isSelected || isHovered || hasWeeklyActivity || flash > 0.05) {
          ctx.beginPath();
          ctx.arc(sx, sy, r + (isSelected || isHovered ? 3.5 : 1.5 + flash * 1.4), 0, Math.PI * 2);
          ctx.strokeStyle = isSelected || isHovered
            ? (palette.isLight ? '#0f172a' : '#ffffff')
            : hexToRgba(node.color, Math.min(0.95, 0.5 + breath * 0.2 + flash * 0.4));
          ctx.lineWidth = isSelected || isHovered ? 2 : 1 + flash * 0.9;
          ctx.stroke();
        }

        // Expanding ripples on wave origin/arrival
        if (!reducedMotion && ripples.length) {
          ripples.forEach((rp) => {
            if (rp.nodeId !== node.id) return;
            const ringR = r * (1 + rp.progress * rp.maxMult);
            ctx.beginPath();
            ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = hexToRgba(rp.color, (1 - rp.progress) * 0.82);
            ctx.lineWidth = Math.max(0.8, 2.2 * (1 - rp.progress));
            ctx.stroke();
          });
        }

        ctx.restore();
      });

      // Pass 2: Structured non-overlapping label pills
      const layer1Ids = graph.nodes.filter((n) => n.layer === 1).map((n) => n.id);
      const layer1Side = new Map(layer1Ids.map((id, idx) => [id, idx % 2 === 0 ? 'left' : 'right']));

      projected.forEach((item) => {
        const { node, sx, sy, r } = item;
        const isSelected = node.id === activeSelectedId;
        const isHovered = node.id === hoveredNodeId;
        const isRelated = !focusNodeSet || focusNodeSet.has(node.id);

        ctx.save();
        ctx.font = `${isSelected || isHovered ? 'bold ' : ''}${isNarrow ? 9.5 : 11}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metricText = graph.sourceKind === 'recent_7d'
          ? (node.sharePct > 0 ? ` · ${node.sharePct}%` : '')
          : (node.repoCount > 0 ? ` · ${node.repoCount}` : '');
        const countSuffix = !isNarrow ? metricText : '';
        const lbl = node.label + countSuffix;
        const textW = ctx.measureText(lbl).width;
        const pillW = textW + (isNarrow ? 10 : 14);
        const pillH = isNarrow ? 16 : 19;

        let pillX = sx - pillW / 2;
        let pillY = sy + r + 5;

        if (!isNarrow) {
          if (node.layer === 0) {
            pillX = sx - r - 10 - pillW;
            pillY = sy - pillH / 2;
          } else if (node.layer === 2) {
            pillX = sx + r + 10;
            pillY = sy - pillH / 2;
          } else {
            const side = layer1Side.get(node.id) || 'right';
            pillX = side === 'left' ? sx - r - 10 - pillW : sx + r + 10;
            pillY = sy - pillH / 2;
          }
        }

        pillX = Math.max(6, Math.min(width - pillW - 6, pillX));
        pillY = Math.max(30, Math.min(height - pillH - 4, pillY));

        drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 9);
        if (isRelated) {
          ctx.fillStyle = palette.pillBg;
          ctx.strokeStyle = isSelected || isHovered ? node.color : palette.pillBorder;
          ctx.lineWidth = isSelected || isHovered ? 1.5 : 0.9;
        } else {
          ctx.fillStyle = palette.isLight ? 'rgba(226, 232, 240, 0.94)' : 'rgba(10, 22, 34, 0.88)';
          ctx.strokeStyle = palette.isLight ? 'rgba(100, 116, 139, 0.35)' : 'rgba(125, 211, 252, 0.14)';
          ctx.lineWidth = 0.85;
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isRelated
          ? palette.pillText
          : (palette.isLight ? '#475569' : 'rgba(156, 195, 221, 0.58)');
        ctx.fillText(lbl, pillX + pillW / 2, pillY + pillH / 2 + 0.5);

        ctx.restore();
      });
    }

    function pickNodeAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      for (let i = latestProjected.length - 1; i >= 0; i -= 1) {
        const p = latestProjected[i];
        const dist = Math.hypot(x - p.sx, y - p.sy);
        if (dist <= p.r + 10) {
          return p.node;
        }
      }
      return null;
    }

    function tick(now) {
      if (destroyed) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastFrameTs) / 1000));
      lastFrameTs = now;
      pulseClock += dt;

      if (autoRotate && !dragging && !hoveredNodeId) {
        baseClock += dt;
        rotY = Math.sin(baseClock * 0.55) * 0.22;
        rotX = -0.06 + Math.cos(baseClock * 0.42) * 0.06;
      }

      stepAnimations(dt);
      drawFrame();
      if (!reducedMotion) {
        rafId = requestAnimationFrame(tick);
      }
    }

    const onPointerDown = (ev) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      dragging = true;
      moved = false;
      startX = ev.clientX;
      startY = ev.clientY;
      startRotX = rotX;
      startRotY = rotY;
      canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (ev) => {
      if (dragging) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) > 8) {
          moved = true;
          if (autoRotate) {
            autoRotate = false;
            notifyAuto();
          }
        }
        rotY = Math.max(-0.38, Math.min(0.38, startRotY + dx * 0.004));
        rotX = Math.max(-0.24, Math.min(0.24, startRotX + dy * 0.003));
        if (reducedMotion) drawFrame();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (
        ev.clientX < rect.left ||
        ev.clientX > rect.right ||
        ev.clientY < rect.top ||
        ev.clientY > rect.bottom
      ) {
        if (hoveredNodeId) {
          hoveredNodeId = null;
          canvas.style.cursor = 'grab';
          if (typeof onHoverNode === 'function') onHoverNode(null);
          if (reducedMotion) drawFrame();
        }
        return;
      }

      const hit = pickNodeAt(ev.clientX, ev.clientY);
      const nextId = hit ? hit.id : null;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (nextId !== hoveredNodeId) {
        hoveredNodeId = nextId;
        if (nextId) {
          triggerSynapseWave(nextId);
        }
        if (typeof onHoverNode === 'function') onHoverNode(hit || null);
        if (reducedMotion) drawFrame();
      }
    };

    const onPointerUp = (ev) => {
      if (!dragging) return;
      dragging = false;
      const hit = !moved ? pickNodeAt(ev.clientX, ev.clientY) : null;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (hit && typeof onSelectNode === 'function') {
        onSelectNode(hit);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let resizeObserver = null;
    if (typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    resize();
    notifyAuto();
    if (!reducedMotion) {
      if (activeSelectedId) {
        triggerSynapseWave(activeSelectedId);
      } else if (graph.defaultFocusId) {
        triggerSynapseWave(graph.defaultFocusId);
      }
      rafId = requestAnimationFrame(tick);
    }

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener('resize', resize);
        canvas.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      },
      reset() {
        rotX = -0.06;
        rotY = 0.08;
        baseClock = 0;
        drawFrame();
      },
      toggleAuto() {
        if (reducedMotion) return false;
        autoRotate = !autoRotate;
        notifyAuto();
        return autoRotate;
      },
      setSelected(id) {
        const nextId = id || null;
        const changed = nextId && nextId !== activeSelectedId;
        activeSelectedId = nextId;
        if (changed) {
          triggerSynapseWave(nextId);
        }
        drawFrame();
      },
      redrawTheme() {
        palette = readThemePalette();
        drawFrame();
      }
    };
  }

  root.neuralNet = {
    mountTechNeuralNet
  };
})();
