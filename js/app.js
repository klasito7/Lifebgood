(() => {
'use strict';
const D = window.LB_DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let KEY = 'lifebgood-v1';            // el modo prueba usa otra clave para no mezclar
const QUERY_R = 1800;                 // radio de búsqueda de lugares (m)
const DEMO_POS = [-34.6037, -58.3816]; // Obelisco, solo para el modo prueba
const OVERPASS = 'https://overpass-api.de/api/interpreter';

/* ---------- utilidades ---------- */
const dayKey = d => d.toLocaleDateString('sv-SE');
const today = () => dayKey(new Date());
const toRad = x => x * Math.PI / 180;
const dist = (a, b) => {
  const dLa = toRad(b[0] - a[0]), dLo = toRad(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
const fmtD = m => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' km';
const fmtKm = k => k.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const lvl = xp => { let L = 1; while (xp >= 50 * L * (L + 1)) L++; return { L, lo: 50 * (L - 1) * L, hi: 50 * L * (L + 1) }; };

/* ---------- estado (queda en este celu) ---------- */
const blank = () => ({ v: 1, intro: false, xp: 0, at: { F: 0, U: 0, C: 0, R: 0 }, km: 0, kmDay: {}, xpDay: {}, log: [], visited: {}, cells: {}, day: null, missions: [], rerolls: 0, expired: 0, perfect: {}, poi: null });
let S = blank();
function load() { S = blank(); try { const r = localStorage.getItem(KEY); if (r) S = Object.assign(blank(), JSON.parse(r)); } catch (e) { /* sin almacenamiento */ } }
load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* lleno o bloqueado */ } };

/* ---------- sprites ---------- */
const PAL = { h: '#3a2418', s: '#e2a877', e: '#111', w: '#f4f6ff', b: '#2448d8', p: '#2a3150', k: '#151515' };
const HERO = ['....hhhh....', '...hhhhhh...', '...hssssh...', '...sesses...', '...ssssss...', '....ssss....', '..wbwwwwbw..', '.swwbwwbwws.', '.swwwbbwwws.', '.s.wwwwww.s.', '...wwwwww...', '...pppppp...', '...pp..pp...', '...pp..pp...', '..kkk..kkk..'];
const sprite = rows => `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" width="100%" height="100%" aria-hidden="true">${rows.map((r, y) => [...r].map((c, x) => c === '.' ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[c]}"/>`).join('')).join('')}</svg>`;
$('#heroBig').innerHTML = sprite(HERO);

/* ---------- mapa ---------- */
const map = L.map('map', { zoomControl: false }).setView(DEMO_POS, 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
const me = L.marker(DEMO_POS, { icon: L.divIcon({ className: 'lb-icon', html: `<div class="me-in">${sprite(HERO)}</div>`, iconSize: [30, 38], iconAnchor: [15, 36] }), zIndexOffset: 1000, interactive: false, keyboard: false });
const accC = L.circle(DEMO_POS, { radius: 0, color: '#2448d8', weight: 1, fillOpacity: .08, interactive: false });
const layer = L.layerGroup().addTo(map);
const RCOL = { c: '#5b6596', r: '#2f55e0', e: '#e2392d' };

let pos = null, demo = false, first = true, follow = true, last = null, fetching = false, failAt = 0, watchId = null;
map.on('dragstart', () => { follow = false; $('#centrar').classList.add('on'); });
map.on('click', e => { if (demo) onPos({ coords: { latitude: e.latlng.lat, longitude: e.latlng.lng, accuracy: 5 } }); });

/* ---------- ubicación ---------- */
function startGPS() {
  if (!('geolocation' in navigator)) return showErr('Este navegador no tiene GPS.');
  $('#gps').textContent = 'Buscando GPS…';
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(onPos, err => {
    if (!pos) showErr(err.code === 1 ? 'No me diste permiso para usar la ubicación.' : 'No pude conseguir tu ubicación. Probá al aire libre.');
    else { $('#gps').textContent = 'GPS perdido'; $('#gps').className = 'chip warn'; }
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}
function startDemo() {
  demo = true; KEY = 'lifebgood-demo'; load(); hud(); draw();
  $('#intro').hidden = true; $('#err').hidden = true;
  onPos({ coords: { latitude: DEMO_POS[0], longitude: DEMO_POS[1], accuracy: 5 } });
  toast('Modo prueba: tocá el mapa para moverte');
}
function showErr(t) { $('#errTxt').textContent = t; $('#err').hidden = false; }

function onPos(p) {
  const ll = [p.coords.latitude, p.coords.longitude], acc = p.coords.accuracy || 50;
  pos = { ll, acc };
  $('#err').hidden = true;
  if (first) { me.addTo(map); accC.addTo(map); map.setView(ll, 17); first = false; }
  me.setLatLng(ll); accC.setLatLng(ll).setRadius(acc);
  if (follow) map.panTo(ll);
  const good = demo || acc <= 25;
  $('#gps').textContent = demo ? 'Modo prueba' : good ? 'GPS ok' : 'GPS ±' + Math.round(acc) + ' m';
  $('#gps').className = 'chip ' + (good ? 'ok' : 'warn');
  track(ll, acc);
  dayCheck();
  ensurePOIs();
  if (openM && !hold) renderModal();
  if (tab === 'misiones') renderSheet();
}

/* kilómetros caminados y zonas pisadas (~100 m) */
function track(ll, acc) {
  if (acc > 30) return;
  const ck = Math.floor(ll[0] / 0.0009) + ':' + Math.floor(ll[1] / 0.0011);
  if (!S.cells[ck]) S.cells[ck] = today();
  const now = Date.now();
  if (last) {
    const d = dist(last.ll, ll), dt = Math.max((now - last.t) / 1000, 1);
    if (d < 10) { save(); return; }
    const vehiculo = !demo && d / dt > 2.8; // más de ~10 km/h: tren, bondi o auto, no cuenta
    if (!vehiculo && d < 1500) { const t = today(); S.km += d / 1000; S.kmDay[t] = (S.kmDay[t] || 0) + d / 1000; }
  }
  last = { ll, t: now };
  save(); hud();
}

/* ---------- lugares de OpenStreetMap ---------- */
const classify = t => /^(kiosk|convenience)$/.test(t.shop || '') ? 'kiosco' : t.shop === 'bakery' ? 'panaderia' : t.leisure === 'park' ? 'plaza' : (t.amenity === 'ice_cream' || t.shop === 'ice_cream') ? 'heladeria' : t.shop === 'greengrocer' ? 'verduleria' : t.amenity === 'cafe' ? 'cafe' : null;

async function fetchPOIs(ll) {
  // se consulta con el punto redondeado (~500 m) para no mandar tu ubicación exacta
  const c = [+(Math.round(ll[0] / 0.005) * 0.005).toFixed(3), +(Math.round(ll[1] / 0.005) * 0.005).toFixed(3)];
  const a = `(around:${QUERY_R},${c[0]},${c[1]})`;
  const q = `[out:json][timeout:25];(nwr["shop"~"^(kiosk|convenience)$"]${a};nwr["shop"="bakery"]${a};nwr["leisure"="park"]${a};nwr["amenity"="ice_cream"]${a};nwr["shop"="ice_cream"]${a};nwr["shop"="greengrocer"]${a};nwr["amenity"="cafe"]${a};);out center 500;`;
  const r = await fetch(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error('Overpass ' + r.status);
  const j = await r.json();
  const list = [];
  for (const el of j.elements || []) {
    const tags = el.tags || {}, type = classify(tags);
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null || !type) continue;
    list.push({ id: el.type[0] + el.id, ll: [lat, lon], type, name: (tags.name || '').slice(0, 60) });
  }
  S.poi = { c, t: Date.now(), list };
  save();
}

async function ensurePOIs() {
  if (!pos || fetching) return;
  const stale = !S.poi || dist(S.poi.c, pos.ll) > 1000 || Date.now() - S.poi.t > 7 * 864e5;
  if (stale && Date.now() - failAt > 60000) {
    fetching = true; if (tab === 'misiones') renderSheet();
    try { await fetchPOIs(pos.ll); }
    catch (e) { failAt = Date.now(); toast('No pude cargar los lugares. Pruebo de nuevo en un minuto.'); }
    fetching = false;
  }
  if (S.poi && !S.day) gen(false);
  draw();
  if (tab === 'misiones') renderSheet();
}

/* ---------- misiones del día ---------- */
function mk(p, rar, R, t) {
  const T = D.TYPES[p.type], tp = T.t[Math.floor(R() * T.t.length)], nuevo = !S.visited[p.id];
  return { id: t + ':' + p.id, poi: p.id, ll: p.ll, type: p.type, name: p.name, txt: tp[0], a: tp[1], rar, xp: D.RAR[rar].xp + (nuevo ? 20 : 0), nuevo, st: 'open' };
}
function gen(reroll) {
  if (!pos || !S.poi) return;
  const t = today(), here = pos.ll;
  const R = rng(hash(t + (reroll ? 'r' + S.rerolls : '') + here.map(x => x.toFixed(2)).join()));
  const L0 = S.poi.list.map(p => ({ ...p, d: dist(here, p.ll) })).filter(p => p.d < 2200);
  for (let i = L0.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [L0[i], L0[j]] = [L0[j], L0[i]]; }
  const used = new Set();
  const pick = (f, n, rar) => L0.filter(p => !used.has(p.id) && f(p)).slice(0, n).map(p => { used.add(p.id); return mk(p, rar, R, t); });
  S.missions = [
    ...pick(p => p.d < 350, 3, 'c'),
    ...pick(p => p.d >= 350 && p.d < 900 || (!S.visited[p.id] && p.d < 900), 3, 'r'),
    ...pick(p => p.d >= 900, 2, 'e')
  ];
  S.day = t;
  save();
}
function dayCheck() {
  const t = today();
  if (S.day && S.day !== t) {
    S.expired += S.missions.filter(m => m.st !== 'done').length;
    S.missions = []; S.day = null; S.rerolls = 0;
    save(); draw();
  }
}

function draw() {
  layer.clearLayers();
  for (const m of S.missions) {
    const T = D.TYPES[m.type];
    if (m.st !== 'done') L.circle(m.ll, { radius: T.r, color: RCOL[m.rar], weight: 2, dashArray: '4 6', fill: false, interactive: false }).addTo(layer);
    L.marker(m.ll, { icon: L.divIcon({ className: 'lb-icon', html: `<div class="poi r-${m.rar}${m.st === 'done' ? ' ok' : ''}">${m.st === 'done' ? '✓' : T.g}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }), title: m.txt })
      .on('click', () => openMission(m.id)).addTo(layer);
  }
}

/* ---------- abrir misión y capturar ---------- */
let openM = null, hold = null;
const holdMs = () => demo ? 3000 : 20000;
const inRange = (m, extra = 0) => pos && dist(pos.ll, m.ll) <= D.TYPES[m.type].r + Math.min(pos.acc, 30) + extra;

function openMission(id) { openM = id; hold = null; renderModal(); $('#modal').hidden = false; }
function closeModal() { openM = null; hold = null; $('#modal').hidden = true; }
function renderModal() {
  const m = S.missions.find(x => x.id === openM);
  if (!m) return closeModal();
  const T = D.TYPES[m.type], d = pos ? dist(pos.ll, m.ll) : null, ok = inRange(m);
  const pr = hold ? Math.min(1, (Date.now() - hold) / holdMs()) : 0;
  let action;
  if (m.st === 'done') action = '<p class="okmsg">Misión cumplida</p>';
  else if (hold) action = `<div class="hold"><div class="bar"><i style="width:${pr * 100}%"></i></div><p>Quedate cerca… ${Math.ceil((1 - pr) * holdMs() / 1000)} s</p></div>`;
  else action = ok ? '<button class="big" id="here">Estoy acá</button>'
    : `<button class="big" id="here" data-far="1">${d == null ? 'Esperando GPS…' : 'Te faltan ' + fmtD(Math.max(0, d - T.r))}</button>`;
  $('#modalBody').innerHTML = `<div><span class="tag r-${m.rar}">${D.RAR[m.rar].n}</span><span class="tag">${T.n}</span>${m.nuevo ? '<span class="tag nw">Lugar nuevo</span>' : ''}</div>
    <h2>${esc(m.txt)}</h2>
    <p class="mute">${esc(m.name || T.n + ' sin nombre')}${d != null ? ' · a ' + fmtD(d) : ''}</p>
    <div class="rw"><span>+${m.xp} XP</span><span>${D.ATTR[m.a]}</span></div>
    ${action}
    <a class="lnk" href="https://www.openstreetmap.org/?mlat=${m.ll[0]}&mlon=${m.ll[1]}#map=18/${m.ll[0]}/${m.ll[1]}" target="_blank" rel="noopener">Ver el lugar en OpenStreetMap</a>
    <button class="ghost" id="closeM">Cerrar</button>`;
}
function tickHold() {
  const m = S.missions.find(x => x.id === openM);
  if (!m) { hold = null; return; }
  if (!inRange(m, 10)) { hold = null; toast('Te alejaste: se cortó la captura'); renderModal(); return; }
  if (Date.now() - hold >= holdMs()) complete(m); else renderModal();
}
function complete(m) {
  const before = lvl(S.xp).L, t = today();
  m.st = 'done'; hold = null;
  S.xp += m.xp; S.at[m.a] = (S.at[m.a] || 0) + m.xp;
  S.xpDay[t] = (S.xpDay[t] || 0) + m.xp;
  S.visited[m.poi] = { d: t, type: m.type };
  S.log.push({ t, type: m.type, rar: m.rar, a: m.a, xp: m.xp, txt: m.txt, name: m.name });
  if (S.missions.every(x => x.st === 'done')) S.perfect[t] = 1;
  save(); draw(); hud(); renderModal(); renderSheet();
  const L2 = lvl(S.xp).L;
  toast(L2 > before ? `¡Subiste a nivel ${L2}!` : `Misión cumplida: +${m.xp} XP`);
  try { navigator.vibrate && navigator.vibrate([60, 40, 140]); } catch (e) { /* sin vibración */ }
}

/* ---------- HUD ---------- */
function hud() {
  const { L, lo, hi } = lvl(S.xp);
  $('#lv').textContent = L;
  $('#xpb').style.width = ((S.xp - lo) / (hi - lo) * 100) + '%';
  $('#xpt').textContent = `${S.xp} XP · faltan ${hi - S.xp} para nivel ${L + 1}`;
  $('#kmHoy').textContent = fmtKm(S.kmDay[today()] || 0) + ' hoy';
}

/* ---------- paneles ---------- */
let tab = 'mapa';
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $('#sheet').hidden = t === 'mapa';
  renderSheet();
}
function renderSheet() {
  if (tab === 'mapa') return;
  $('#sheetBody').innerHTML = tab === 'misiones' ? vMis() : tab === 'stats' ? vStats() : vLogros();
}
const leftToday = () => { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); const s = (m - n) / 1000; return Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min'; };
const ORD = { c: 0, r: 1, e: 2 };

function vMis() {
  if (!S.missions.length) {
    const msg = !pos ? 'Esperando tu ubicación…' : fetching ? 'Buscando lugares cerca tuyo…' : S.poi ? 'No encontré lugares cerca. Probá moverte un poco.' : 'Todavía no pude cargar los lugares.';
    return `<h2>Misiones de hoy</h2><p class="mute">${msg}</p>`;
  }
  const done = S.missions.filter(m => m.st === 'done').length;
  const ms = [...S.missions].sort((a, b) => (a.st === 'done') - (b.st === 'done') || ORD[a.rar] - ORD[b.rar]);
  return `<h2>Misiones de hoy</h2><p class="mute">${done} de ${S.missions.length} cumplidas · vencen en ${leftToday()}</p>
  <ul class="ml">${ms.map(m => { const T = D.TYPES[m.type]; return `<li><button class="mi ${m.st}" data-open="${esc(m.id)}"><span class="poi r-${m.rar}${m.st === 'done' ? ' ok' : ''}">${m.st === 'done' ? '✓' : T.g}</span><span class="tx"><b>${esc(m.txt)}</b><small>${esc(m.name || T.n)}${pos ? ' · ' + fmtD(dist(pos.ll, m.ll)) : ''} · ${D.RAR[m.rar].n} · +${m.xp} XP</small></span></button></li>`; }).join('')}</ul>
  <button class="ghost" id="reroll" ${S.rerolls >= 1 ? 'disabled' : ''}>${S.rerolls >= 1 ? 'Ya cambiaste las misiones hoy' : 'Cambiar misiones a donde estoy (1 vez por día)'}</button>`;
}

function streak() {
  let n = 0; const d = new Date();
  if (!S.xpDay[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (S.xpDay[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const count = k => S.log.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + 1, o), {});
const rows = (arr, mx, col) => arr.map(([l, v, r]) => `<div class="row"><span>${l}</span><div class="bar" style="--c:${col}"><i style="width:${mx ? v / mx * 100 : 0}%"></i></div><span>${r}</span></div>`).join('');

function vStats() {
  const { L } = lvl(S.xp);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d); return [d.toLocaleDateString('es-AR', { weekday: 'short' }), S.xpDay[k] || 0, S.kmDay[k] || 0]; });
  const mxd = Math.max(...days.map(d => d[1]));
  const ACOL = { F: 'var(--coral)', U: 'var(--blue)', C: 'var(--mint)', R: 'var(--cyan)' };
  const mxa = Math.max(...Object.values(S.at));
  const bt = count('type'), br = count('rar');
  const mxt = Math.max(0, ...Object.values(bt));
  const cards = [['Nivel', L], ['XP total', S.xp], ['Km caminados', fmtKm(S.km)], ['Misiones', S.log.length], ['Lugares descubiertos', Object.keys(S.visited).length], ['Zonas pisadas', Object.keys(S.cells).length], ['Racha', streak() === 1 ? '1 día' : streak() + ' días'], ['Vencidas', S.expired]];
  return `<h2>Estadísticas</h2>
  <div class="grid">${cards.map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
  <h3>Últimos 7 días</h3>${rows(days.map(([l, x, k]) => [l, x, x + ' XP · ' + fmtKm(k)]), mxd, 'var(--coral)')}
  <h3>Atributos</h3>${Object.keys(D.ATTR).map(k => `<div class="row"><span>${D.ATTR[k]}</span><div class="bar" style="--c:${ACOL[k]}"><i style="width:${mxa ? (S.at[k] || 0) / mxa * 100 : 0}%"></i></div><span>${S.at[k] || 0} XP</span></div>`).join('')}
  <h3>Por tipo de lugar</h3>${rows(Object.keys(D.TYPES).map(k => [D.TYPES[k].n, bt[k] || 0, (bt[k] || 0) + ' misiones']), mxt, 'var(--blue)')}
  <h3>Por rareza</h3><p class="mute">Comunes ${br.c || 0} · Raras ${br.r || 0} · Épicas ${br.e || 0}</p>
  <h3>Tus datos</h3><p class="mute">Todo queda guardado en este navegador. Hacé una copia de vez en cuando por si cambiás de celu.</p>
  <div class="btns"><button class="ghost" id="exp">Exportar copia</button><button class="ghost" id="imp">Importar copia</button></div>
  <button class="ghost" id="wipe">Borrar todo el progreso</button>`;
}

const cntT = t => Object.values(S.visited).filter(v => v.type === t).length;
const ACH = [
  ['Primer paso', 'Cumplí tu primera misión', () => [S.log.length, 1]],
  ['Kiosquero', 'Visitá 5 kioscos distintos', () => [cntT('kiosco'), 5]],
  ['Plaza tomada', 'Cumplí misiones en 5 plazas distintas', () => [cntT('plaza'), 5]],
  ['Leyenda épica', 'Cumplí una misión épica', () => [S.log.filter(x => x.rar === 'e').length, 1]],
  ['Día redondo', 'Cumplí todas las misiones de un día', () => [Object.keys(S.perfect).length, 1]],
  ['Racha de 3', 'Cumplí misiones 3 días seguidos', () => [streak(), 3]],
  ['Racha de 7', 'Cumplí misiones 7 días seguidos', () => [streak(), 7]],
  ['Caminante', 'Caminá 10 km en total', () => [Math.floor(S.km), 10]],
  ['Explorador', 'Pisá 100 zonas distintas del mapa', () => [Object.keys(S.cells).length, 100]],
  ['Charlatán', 'Cumplí 10 misiones de Carisma', () => [S.log.filter(x => x.a === 'C').length, 10]],
  ['Nivel 5', 'Llegá al nivel 5', () => [lvl(S.xp).L, 5]],
  ['Coleccionista', 'Descubrí 30 lugares distintos', () => [Object.keys(S.visited).length, 30]]
];
function vLogros() {
  const got = ACH.filter(a => { const [v, t] = a[2](); return v >= t; }).length;
  return `<h2>Logros</h2><p class="mute">${got} de ${ACH.length} desbloqueados</p><div class="achs">${ACH.map(([n, d, f]) => {
    const [v, t] = f(), ok = v >= t;
    return `<div class="ach ${ok ? '' : 'off'}"><div class="medal">${ok ? '★' : Math.min(v, t) + '/' + t}</div><div><b>${n}</b><small>${d}</small></div></div>`;
  }).join('')}</div>`;
}

/* ---------- aviso ---------- */
let tt;
function toast(msg) { const e = $('#toast'); e.textContent = msg; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), 3200); }

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  if (e.target.id === 'modal') return closeModal();
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tab) return setTab(b.dataset.tab);
  if (b.dataset.open) return openMission(b.dataset.open);
  switch (b.id) {
    case 'here': {
      const m = S.missions.find(x => x.id === openM);
      if (!m) return;
      if (!inRange(m)) { toast('Todavía estás lejos. Acercate y probá de nuevo.'); renderModal(); return; }
      hold = Date.now(); renderModal(); break;
    }
    case 'closeM': closeModal(); break;
    case 'centrar': follow = true; b.classList.remove('on'); if (pos) map.setView(pos.ll, 17); break;
    case 'goGps': S.intro = true; save(); $('#intro').hidden = true; startGPS(); break;
    case 'retry': $('#err').hidden = true; startGPS(); break;
    case 'goDemo': case 'goDemo2': startDemo(); break;
    case 'reroll':
      if (!pos || S.rerolls >= 1) return;
      if (!S.poi || dist(S.poi.c, pos.ll) > 1000) { fetching = true; renderSheet(); try { await fetchPOIs(pos.ll); } catch (err) { fetching = false; toast('No pude cargar los lugares de esta zona.'); renderSheet(); return; } fetching = false; }
      S.rerolls = 1; gen(true); draw(); renderSheet(); toast('Misiones nuevas cerca tuyo'); break;
    case 'exp': {
      const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lifebgood-copia-${today()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000); break;
    }
    case 'imp': $('#impF').click(); break;
    case 'wipe':
      if (b.dataset.sure) { S = Object.assign(blank(), { intro: true }); save(); draw(); hud(); renderSheet(); toast('Progreso borrado'); ensurePOIs(); }
      else { b.dataset.sure = '1'; b.textContent = 'Tocá de nuevo para borrar todo'; }
      break;
  }
});
$('#impF').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const o = JSON.parse(await f.text()); if (typeof o.xp !== 'number') throw 0; S = Object.assign(blank(), o); save(); draw(); hud(); renderSheet(); toast('Copia importada'); }
  catch (err) { toast('Ese archivo no es una copia de Lifebgood'); }
  e.target.value = '';
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openM) closeModal(); });

setInterval(() => { if (hold) tickHold(); }, 250);
setInterval(() => { dayCheck(); if (tab === 'misiones') renderSheet(); }, 60000);

/* ---------- arranque ---------- */
hud(); dayCheck(); draw();
if (location.hash === '#demo') startDemo();
else if (S.intro) startGPS();
else $('#intro').hidden = false;
})();
