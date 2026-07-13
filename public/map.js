// Carte en direct : positions et pseudos des joueurs (API REST location_x/y), zoom/pan,
// regroupement des joueurs proches. Fond : public/map-world.jpg ou public/map-tree.jpg
// (bascule via les boutons .map-layer-btn -> window.setMapLayer), sinon grille de secours si
// le fichier est absent.
(function () {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const MAP_EXTENT = 1000; // coordonnées carte du jeu : -1000..1000 sur les deux axes
  // Conversion coordonnées monde (API REST) -> coordonnées carte : les axes X/Y de l'API REST
  // sont ÉCHANGÉS par rapport aux axes de la carte (location_y alimente l'axe X carte, location_x
  // alimente l'axe Y carte) — ce n'était pas un simple signe inversé comme supposé précédemment.
  const TRANSFORM = { offsetX: 374920.74722089537, offsetY: -355.946119755934, scale: 722.5552870523026 };

  // Vue : centre (coordonnées carte) + zoom (pixels CSS par unité carte)
  const view = { x: 0, y: 0, scale: 0.28 };
  let players = [];

  // Île de l'Arbre (Sakurajima) : coordonnées séparées de l'île principale, les joueurs qui n'y
  // sont pas ne s'affichent donc que sur la carte "world".
  const MAP_LAYERS = { world: '/map-world.jpg', tree: '/map-tree.jpg' };
  let currentLayer = 'world';

  // Image de fond optionnelle
  const mapImage = new Image();
  let mapImageReady = false;
  mapImage.onload = () => { mapImageReady = true; draw(); };
  mapImage.onerror = () => { mapImageReady = false; }; // pas d'image fournie : on garde la grille
  mapImage.src = MAP_LAYERS[currentLayer];

  window.setMapLayer = layer => {
    if (!MAP_LAYERS[layer] || layer === currentLayer) return;
    currentLayer = layer;
    mapImageReady = false;
    mapImage.src = MAP_LAYERS[currentLayer];
    draw();
  };

  // Coordonnées monde (API REST) -> coordonnées carte du jeu (wx=location_x, wy=location_y ;
  // axes échangés, voir commentaire sur TRANSFORM ci-dessus).
  function worldToMap(wx, wy) {
    return { x: (wy + TRANSFORM.offsetY) / TRANSFORM.scale, y: (wx + TRANSFORM.offsetX) / TRANSFORM.scale };
  }

  // Coordonnées carte -> pixels CSS du canvas (nord en haut : y carte croissant vers le haut)
  function toScreen(mx, my) {
    return {
      x: canvas.clientWidth / 2 + (mx - view.x) * view.scale,
      y: canvas.clientHeight / 2 - (my - view.y) * view.scale
    };
  }

  function fromScreen(sx, sy) {
    return {
      x: view.x + (sx - canvas.clientWidth / 2) / view.scale,
      y: view.y - (sy - canvas.clientHeight / 2) / view.scale
    };
  }

  // ---------- Rendu ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawBackground() {
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const tl = toScreen(-MAP_EXTENT, MAP_EXTENT);
    const br = toScreen(MAP_EXTENT, -MAP_EXTENT);

    if (mapImageReady) {
      ctx.drawImage(mapImage, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      return;
    }
    // Grille de secours (pas de 100 unités carte) + cadre
    ctx.strokeStyle = 'rgba(139, 150, 165, 0.12)';
    ctx.lineWidth = 1;
    for (let v = -MAP_EXTENT; v <= MAP_EXTENT; v += 100) {
      const a = toScreen(v, -MAP_EXTENT); const b = toScreen(v, MAP_EXTENT);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = toScreen(-MAP_EXTENT, v); const d = toScreen(MAP_EXTENT, v);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(139, 150, 165, 0.35)';
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  // Regroupe les joueurs dont les positions écran sont à moins de `radius` px (glouton, suffisant
  // pour quelques dizaines de joueurs).
  function clusterPlayers(list, radius = 26) {
    const clusters = [];
    list.forEach(pl => {
      const m = worldToMap(pl.location_x || 0, pl.location_y || 0);
      const s = toScreen(m.x, m.y);
      const near = clusters.find(c => Math.hypot(c.x - s.x, c.y - s.y) < radius);
      if (near) near.players.push(pl);
      else clusters.push({ x: s.x, y: s.y, players: [pl] });
    });
    return clusters;
  }

  function drawPlayers() {
    const withPos = players.filter(p => p.location_x != null && p.location_y != null);
    clusterPlayers(withPos).forEach(c => {
      if (c.players.length === 1) {
        ctx.fillStyle = '#e2984a';
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e7ebf0';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(c.players[0].name || '?', c.x + 10, c.y + 4);
      } else {
        ctx.fillStyle = '#e2984a';
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#14181f';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(c.players.length), c.x, c.y + 4);
        ctx.textAlign = 'start';
        ctx.fillStyle = '#e7ebf0';
        ctx.font = '10px sans-serif';
        ctx.fillText(c.players.map(p => p.name).join(', ').slice(0, 40), c.x + 15, c.y + 4);
      }
    });
  }

  function drawCalibOverlay() {
    if (!calib.active && !calib.result) return;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    if (calib.active) {
      ctx.fillStyle = 'rgba(226, 152, 74, 0.95)';
      const n = calib.points.length;
      ctx.fillText(`CALIBRATION — clique ta vraie position en jeu (point ${n + 1}/2)`, 12, 22);
    } else if (calib.result) {
      const r = calib.result;
      ctx.fillStyle = 'rgba(120, 220, 140, 0.95)';
      ctx.fillText('Nouveau TRANSFORM (recopie-le dans map.js ligne 13) :', 12, 22);
      ctx.fillStyle = '#e7ebf0';
      ctx.font = '12px monospace';
      ctx.fillText(`offsetX: ${r.offsetX}, offsetY: ${r.offsetY}, scale: ${r.scale}`, 12, 42);
    }
    ctx.textAlign = 'start';
  }

  function draw() {
    resize();
    drawBackground();
    // Les positions joueurs sont calées sur les coordonnées de l'île principale : on ne les
    // affiche donc que sur cette carte (voir commentaire MAP_LAYERS plus haut).
    if (currentLayer === 'world') drawPlayers();
    drawCalibOverlay();
  }

  // ---------- Mode calibration (touche "c") ----------
  // Recalcule TRANSFORM (offset/échelle) à partir de points réels au lieu de constantes devinées :
  //   1) place-toi en jeu à un endroit reconnaissable (tu dois être connecté = apparaître dans la
  //      liste des joueurs), appuie sur "c" pour armer,
  //   2) clique sur la carte l'endroit EXACT où tu te trouves réellement,
  //   3) déplace-toi loin (autre bout de la carte), reclique ta vraie position,
  //   -> les nouvelles valeurs TRANSFORM s'affichent (console + à l'écran) : recopie-les ligne 13.
  const calib = { active: false, points: [] };
  // La carte doit être l'onglet visible pour armer la calibration : sinon un utilisateur (même en
  // lecture seule) tapant "c" ailleurs dans l'app déclencherait l'overlay par accident. On ignore
  // aussi la frappe dans tout champ éditable (saisie d'un "c" dans un formulaire).
  function mapTabVisible() {
    const tab = document.getElementById('tab-map');
    return !!tab && tab.classList.contains('active');
  }
  function isEditableTarget(el) {
    return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
  }
  window.addEventListener('keydown', e => {
    if (e.key !== 'c' || isEditableTarget(e.target) || !mapTabVisible()) return;
    calib.active = !calib.active;
    calib.points = [];
    canvas.style.cursor = calib.active ? 'crosshair' : 'grab';
    draw();
  });

  function captureCalibPoint(sx, sy) {
    const me = players.find(p => p.location_x != null && p.location_y != null);
    if (!me) { alert('Aucune position joueur disponible : connecte-toi en jeu d\'abord.'); return; }
    const mapPt = fromScreen(sx, sy); // point cliqué en coordonnées carte (indépendant de TRANSFORM)
    calib.points.push({ wx: me.location_x, wy: me.location_y, mx: mapPt.x, my: mapPt.y });
    if (calib.points.length < 2) { draw(); return; }
    // mapX = (wy + offsetY)/scale ; mapY = (wx + offsetX)/scale (mêmes axes échangés que worldToMap)
    const [a, b] = calib.points;
    const scaleFromX = (a.wy - b.wy) / (a.mx - b.mx);
    const scaleFromY = (a.wx - b.wx) / (a.my - b.my);
    const scale = (scaleFromX + scaleFromY) / 2; // moyenne des deux axes (devraient concorder)
    const offsetY = a.mx * scale - a.wy;
    const offsetX = a.my * scale - a.wx;
    const result = { offsetX, offsetY, scale };
    console.log('Nouveau TRANSFORM :', JSON.stringify(result));
    calib.result = result;
    calib.active = false;
    calib.points = [];
    canvas.style.cursor = 'grab';
    draw();
  }

  // ---------- Interactions ----------
  let dragging = null;
  // En mode calibration : clic GAUCHE valide un point, clic DROIT déplace la carte sans rien
  // valider (pour se repositionner avant de cliquer précisément).
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => {
    if (calib.active && e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      captureCalibPoint(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }
    dragging = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    view.x = dragging.viewX - (e.clientX - dragging.startX) / view.scale;
    view.y = dragging.viewY + (e.clientY - dragging.startY) / view.scale;
    draw();
  });
  window.addEventListener('mouseup', () => { dragging = null; canvas.style.cursor = calib.active ? 'crosshair' : 'grab'; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const before = fromScreen(e.clientX - rect.left, e.clientY - rect.top);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    view.scale = Math.max(0.08, Math.min(4, view.scale * factor));
    const after = fromScreen(e.clientX - rect.left, e.clientY - rect.top);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
    draw();
  }, { passive: false });

  window.addEventListener('resize', draw);

  // app.js pousse la liste des joueurs à chaque rafraîchissement du statut
  window.updateMapPlayers = list => { players = list || []; draw(); };

  draw();
})();
