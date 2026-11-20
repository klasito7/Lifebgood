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
const blank = () => ({ v: 1, intro: false, xp: 0, at: { F: 0, U: 0, C: 0, R: 0 }, km: 0, kmDay: {}, xpDay: {}, log: [], visited: {}, cells: {}, day: null, missions: [], rerolls: 0, expired: 0, perfect: {}, poi: null, tasks: [], dailies: [], learn: {}, gcal: { cid: '', write: false, last: 0 } });
let S = blank();
function load() { S = blank(); try { const r = localStorage.getItem(KEY); if (r) S = Object.assign(blank(), JSON.parse(r)); } catch (e) { /* sin almacenamiento */ } }
load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* lleno o bloqueado */ } };

/* ---------- sprites ---------- */
const PAL = { h: '#3a2418', s: '#e2a877', e: '#111', w: '#f4f6ff', b: '#2448d8', p: '#2a3150', k: '#151515', d: '#0e2a17', n: '#020604', g: '#00ff66', q: '#163a22' };
const HERO = ['....hhhh....', '...hhhhhh...', '...hssssh...', '...sesses...', '...ssssss...', '....ssss....', '..wbwwwwbw..', '.swwbwwbwws.', '.swwwbbwwws.', '.s.wwwwww.s.', '...wwwwww...', '...pppppp...', '...pp..pp...', '...pp..pp...', '..kkk..kkk..'];
const sprite = rows => `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" width="100%" height="100%" aria-hidden="true">${rows.map((r, y) => [...r].map((c, x) => c === '.' ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[c]}"/>`).join('')).join('')}</svg>`;
// skin hacker: capucha negra, cara en sombra y ojos verdes
const HERO_H = ['...dddddd...', '..dddddddd..', '..ddnnnndd..', '..dngnngnd..', '..ddnnnndd..', '...dnnnnd...', '..dddddddd..', '.dddddddddd.', '.dddggggddd.', '.d.dddddd.d.', '...dddddd...', '...qqqqqq...', '...qq..qq...', '...qq..qq...', '..kkk..kkk..'];
const SKIN_KEY = 'lifebgood-skin';
const hacker = () => document.documentElement.dataset.skin === 'hacker';
const heroSprite = () => sprite(hacker() ? HERO_H : HERO);
$('#heroBig').innerHTML = heroSprite();

/* ---------- mapa ---------- */
const map = L.map('map', { zoomControl: false }).setView(DEMO_POS, 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
const meIcon = () => L.divIcon({ className: 'lb-icon', html: `<div class="me-in">${heroSprite()}</div>`, iconSize: [30, 38], iconAnchor: [15, 36] });
const me = L.marker(DEMO_POS, { icon: meIcon(), zIndexOffset: 1000, interactive: false, keyboard: false });
const accC = L.circle(DEMO_POS, { radius: 0, color: hacker() ? '#00ff66' : '#2448d8', weight: 1, fillOpacity: .08, interactive: false });
const layer = L.layerGroup().addTo(map);
const RCOL = { c: '#5b6596', r: '#2f55e0', e: '#e2392d' };
const RCOL_H = { c: '#1f7a3f', r: '#00e5ff', e: '#00ff66' };
const rcol = r => (hacker() ? RCOL_H : RCOL)[r];

function setSkin(k) {
  document.documentElement.dataset.skin = k;
  try { localStorage.setItem(SKIN_KEY, k); } catch (e) { /* sin almacenamiento */ }
  document.querySelector('meta[name=theme-color]').content = k === 'hacker' ? '#020a04' : '#17225a';
  me.setIcon(meIcon()); $('#heroBig').innerHTML = heroSprite();
  accC.setStyle({ color: k === 'hacker' ? '#00ff66' : '#2448d8' });
  draw(); renderSheet();
  toast(k === 'hacker' ? 'Acceso concedido' : 'Skin clásica');
}

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
  const old = S.tasks.filter(x => x.date < t);
  if (old.length) { S.expired += old.filter(x => x.st === 'open').length; S.tasks = S.tasks.filter(x => x.date >= t); save(); }
  if (S.dailies.length) { const n = S.tasks.length; ensureDailies(); if (S.tasks.length !== n) save(); }
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
    if (m.st !== 'done') L.circle(m.ll, { radius: T.r, color: rcol(m.rar), weight: 2, dashArray: '4 6', fill: false, interactive: false }).addTo(layer);
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

/* ---------- agenda: tus propias misiones (carga rápida o Google Calendar) ---------- */
const P = window.LB_PARSE;
const KN = { p: 'Principal', s: 'Secundaria', d: 'Diaria' };
const KNUM = { p: 1, s: 2, d: 3 };
const ACOLS = { F: 'var(--coral)', U: 'var(--blue)', C: 'var(--mint)', R: 'var(--cyan)' };
const CYC_K = ['p', 's', 'd'], CYC_A = ['F', 'U', 'C', 'R'];
const nextOf = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];
const uid = () => Math.random().toString(36).slice(2, 9);
const minsOf = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99');
const fmtDay = d => new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };

function ensureDailies() {
  const t = today();
  for (const d of S.dailies) {
    const id = 'd:' + d.id + ':' + t;
    if (!S.tasks.some(x => x.id === id)) S.tasks.push({ id, src: 'daily', did: d.id, title: d.title, kind: 'd', a: d.a, date: t, time: d.time, xp: P.XP.d, st: 'open' });
  }
}
function learn(title, a, kind) { const k = P.key(title); const o = S.learn[k] || { n: 0 }; S.learn[k] = { title, a, kind, n: o.n + 1 }; }

async function addTask(text, over) {
  const p = P.parse(text, new Date(), S.learn);
  if (!p.title) return toast('Escribí qué misión es');
  if (over.kind) { p.kind = over.kind; p.xp = P.XP[p.kind]; }
  if (over.a) p.a = over.a;
  learn(p.title, p.a, p.kind);
  let task = null, daily = null;
  if (p.kind === 'd') { daily = { id: uid(), title: p.title, a: p.a, time: p.time }; S.dailies.push(daily); ensureDailies(); }
  else { task = { id: 'm:' + uid(), src: 'manual', title: p.title, kind: p.kind, a: p.a, date: p.date, time: p.time, xp: p.xp, st: 'open' }; S.tasks.push(task); }
  save(); renderSheet();
  toast(p.kind === 'd' ? `Diaria agregada: ${p.title}` : `Misión agregada: ${p.title}`);
  if (S.gcal.cid && S.gcal.write) {
    try {
      const ev = await gfetch('/calendars/primary/events', { method: 'POST', body: JSON.stringify(gEvent(p)) }, true);
      if (task) task.gid = ev.id; if (daily) daily.gid = ev.id;
      save(); toast('También quedó en tu Google Calendar');
    } catch (e) { toast(gErr(e)); }
  }
}

function completeTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t || t.st !== 'open' || t.date !== today()) return;
  const before = lvl(S.xp).L, now = new Date();
  const late = !!t.time && Math.abs(now.getHours() * 60 + now.getMinutes() - minsOf(t.time)) > 60;
  const xp = late ? Math.round(t.xp / 2) : t.xp, d = today();
  t.st = 'done'; t.got = xp; t.late = late;
  S.xp += xp; S.at[t.a] = (S.at[t.a] || 0) + xp; S.xpDay[d] = (S.xpDay[d] || 0) + xp;
  S.log.push({ t: d, type: 'agenda', kind: t.kind, a: t.a, xp, txt: t.title, late });
  save(); hud(); renderSheet();
  const L2 = lvl(S.xp).L;
  toast(L2 > before ? `¡Subiste a nivel ${L2}!` : late ? `Hecha fuera de horario: +${xp} XP` : `Misión cumplida: +${xp} XP`);
  try { navigator.vibrate && navigator.vibrate([60, 40, 140]); } catch (e) { /* sin vibración */ }
}
function removeTask(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  if (t.src === 'daily') { S.dailies = S.dailies.filter(d => d.id !== t.did); S.tasks = S.tasks.filter(x => x.did !== t.did || x.st === 'done'); toast('Diaria eliminada'); }
  else if (t.src === 'cal') { t.st = 'hidden'; toast('Oculta (sigue en tu calendario)'); }
  else S.tasks = S.tasks.filter(x => x.id !== id);
  save(); renderSheet();
}
function cycleTask(id, what) {
  const t = S.tasks.find(x => x.id === id); if (!t || t.st !== 'open') return;
  if (what === 'a') t.a = nextOf(CYC_A, t.a);
  else if (t.kind !== 'd') { t.kind = t.kind === 'p' ? 's' : 'p'; t.xp = P.XP[t.kind]; }
  learn(t.title, t.a, t.kind);
  if (t.src === 'daily') { const d = S.dailies.find(x => x.id === t.did); if (d) d.a = t.a; }
  save(); renderSheet();
}

/* pestaña Misiones: el formulario se arma una sola vez para no borrar lo que estás escribiendo */
let qaOver = {};
const vMisShell = () => `<h2>Tu agenda</h2>
  <form id="qa" autocomplete="off"><input id="qaIn" enterkeyhint="done" placeholder="1 pasear a Vaca a las 16" aria-label="Nueva misión"><button class="qabtn" type="submit">Agregar</button></form>
  <div id="qaPrev" class="tags"></div>
  <p class="qahelp">1 principal · 2 secundaria · 3 diaria. Entiende "mañana", "el sábado", "24/11", "a las 16", "19hs". Si la marcás a más de 1 hora del horario, vale la mitad.</p>
  <div id="qaSug" class="tags"></div>
  <div id="agList"></div>
  <h2 class="h2b">Misiones del mapa</h2><div id="mapList"></div>`;
function qaPreview() {
  const i = $('#qaIn'), el = $('#qaPrev'); if (!i || !el) return;
  const v = i.value.trim(); if (!v) { el.innerHTML = ''; qaOver = {}; return; }
  const p = P.parse(v, new Date(), S.learn), kind = qaOver.kind || p.kind, a = qaOver.a || p.a;
  el.innerHTML = `<button type="button" class="tag tb k-${kind}" data-cyc="kind">${KN[kind]} · +${P.XP[kind]} XP</button><button type="button" class="tag tb" data-cyc="a" style="border-color:${ACOLS[a]}">${D.ATTR[a]}</button><span class="tag">${kind === 'd' ? 'Todos los días' : fmtDay(p.date)}${p.time ? ' · ' + p.time : ''}</span><span class="tag">${esc(p.title) || '…'}</span>`;
}
function vSug() {
  const have = new Set(S.tasks.filter(x => x.date === today()).map(x => P.key(x.title)));
  const L0 = Object.entries(S.learn).filter(([k, v]) => v.n >= 2 && !have.has(k)).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  return L0.map(([, v]) => `<button type="button" class="tag tb" data-sug="${esc(KNUM[v.kind] + ' ' + v.title)}">+ ${esc(v.title)}</button>`).join('');
}
function vAgenda() {
  const t = today();
  const td = S.tasks.filter(x => x.date === t && x.st !== 'hidden').sort(byTime);
  const fut = S.tasks.filter(x => x.date > t && x.st !== 'hidden').sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
  const sync = S.gcal.cid ? `<button class="ghost slim" id="gsync2">Sincronizar Google Calendar${S.gcal.last ? ' · ' + ago(S.gcal.last) : ''}</button>` : '';
  const row = x => `<li class="ag ${x.st} k-${x.kind}"><div class="agt">${x.time || '—'}</div><div class="agb"><b>${esc(x.title)}</b><div class="tags">${x.st === 'open'
      ? `<button type="button" class="tag tb k-${x.kind}" data-tkind="${esc(x.id)}">${KN[x.kind]}</button><button type="button" class="tag tb" data-tattr="${esc(x.id)}" style="border-color:${ACOLS[x.a]}">${D.ATTR[x.a]}</button><span class="tag">+${x.xp} XP</span>`
      : `<span class="tag k-${x.kind}">${KN[x.kind]}</span><span class="tag">+${x.got} XP${x.late ? ' (tarde)' : ''}</span>`}${x.src === 'cal' ? '<span class="tag">Calendar</span>' : ''}</div></div>${x.st === 'done' ? '<span class="agok">✓</span>' : `<div class="agac"><button class="agdo" data-done="${esc(x.id)}">Hecha</button><button class="agx" data-del="${esc(x.id)}" aria-label="Quitar">×</button></div>`}</li>`;
  return sync + (td.length ? `<ul class="agl">${td.map(row).join('')}</ul>` : '<p class="mute">Nada cargado para hoy. Escribí arriba tu primera misión.</p>')
    + (fut.length ? `<h3>Próximos días</h3><ul class="agl">${fut.map(x => `<li class="ag fut k-${x.kind}"><div class="agt">${fmtDay(x.date)}<small>${x.time || ''}</small></div><div class="agb"><b>${esc(x.title)}</b><div class="tags"><span class="tag k-${x.kind}">${KN[x.kind]}</span>${x.src === 'cal' ? '<span class="tag">Calendar</span>' : ''}</div></div><div class="agac"><button class="agx" data-del="${esc(x.id)}" aria-label="Quitar">×</button></div></li>`).join('')}</ul>` : '');
}

/* ---------- Google Calendar (todo pasa entre tu celu y Google) ---------- */
const GSCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
let gTok = null;
try { const t = JSON.parse(sessionStorage.getItem('lb-gtok') || 'null'); if (t && t.exp > Date.now()) gTok = t; } catch (e) { /* nada */ }
function loadGis() {
  return new Promise((res, rej) => {
    if (window.google && google.accounts && google.accounts.oauth2) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('gis')); document.head.appendChild(s);
  });
}
async function getToken(interactive) {
  if (gTok && gTok.exp > Date.now() + 60000) return gTok.v;
  if (!interactive) return null;
  if (!S.gcal.cid) throw new Error('cid');
  await loadGis();
  return new Promise((res, rej) => {
    const c = google.accounts.oauth2.initTokenClient({
      client_id: S.gcal.cid, scope: GSCOPE,
      callback: r => {
        if (r.error) return rej(new Error(r.error));
        gTok = { v: r.access_token, exp: Date.now() + (Number(r.expires_in || 3600) - 60) * 1000 };
        try { sessionStorage.setItem('lb-gtok', JSON.stringify(gTok)); } catch (e) { /* nada */ }
        res(gTok.v);
      },
      error_callback: e => rej(new Error((e && e.type) || 'popup'))
    });
    c.requestAccessToken({ prompt: '' });
  });
}
async function gfetch(path, opt, interactive) {
  const tok = await getToken(interactive);
  if (!tok) throw new Error('notoken');
  const r = await fetch('https://www.googleapis.com/calendar/v3' + path, Object.assign({}, opt, { headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } }));
  if (r.status === 401) { gTok = null; try { sessionStorage.removeItem('lb-gtok'); } catch (e) { /* nada */ } throw new Error('401'); }
  if (!r.ok) throw new Error('g' + r.status);
  return r.status === 204 ? null : r.json();
}
function gErr(e) {
  const m = String(e && e.message || e);
  return m === 'cid' ? 'Falta el ID de cliente de Google'
    : /popup/.test(m) ? 'Se cerró o se bloqueó la ventana de Google'
    : m === 'access_denied' ? 'No le diste permiso al calendario'
    : m === '401' || m === 'notoken' ? 'Se venció el permiso: tocá Sincronizar de nuevo'
    : m === 'gis' ? 'No pude cargar el acceso de Google'
    : m === 'g403' ? 'Google rechazó el pedido: revisá que la API de Calendar esté habilitada'
    : 'Error con Google Calendar (' + m + ')';
}
function gEvent(p) {
  const ev = { summary: KNUM[p.kind] + ' ' + p.title, description: 'Creado desde Lifebgood' };
  if (p.time) {
    const st = new Date(`${p.date}T${p.time}:00`), en = new Date(st.getTime() + 3600000);
    const f = d => `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
    ev.start = { dateTime: f(st), timeZone: TZ }; ev.end = { dateTime: f(en), timeZone: TZ };
  } else {
    const n = new Date(p.date + 'T12:00'); n.setDate(n.getDate() + 1);
    ev.start = { date: p.date }; ev.end = { date: dayKey(n) };
  }
  if (p.kind === 'd') ev.recurrence = ['RRULE:FREQ=DAILY'];
  return ev;
}
let syncing = false;
async function syncCal(interactive) {
  if (syncing || !S.gcal.cid) return;
  syncing = true;
  try {
    const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(a); b.setDate(b.getDate() + 8);
    const j = await gfetch(`/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(a.toISOString())}&timeMax=${encodeURIComponent(b.toISOString())}`, {}, interactive);
    const own = new Set([...S.tasks.filter(x => x.src !== 'cal'), ...S.dailies].map(x => x.gid).filter(Boolean));
    const seen = new Set(); let n = 0;
    for (const ev of j.items || []) {
      if (ev.status === 'cancelled' || !ev.summary || own.has(ev.id) || own.has(ev.recurringEventId)) continue;
      const st = ev.start || {};
      if (!st.date && !st.dateTime) continue;
      const date = st.date || dayKey(new Date(st.dateTime));
      const time = st.dateTime ? new Date(st.dateTime).toTimeString().slice(0, 5) : null;
      const p = P.parse(ev.summary, new Date(), S.learn);
      const kind = p.kind === 'd' ? 's' : p.kind, id = 'g:' + ev.id;
      seen.add(id); n++;
      const t = S.tasks.find(x => x.id === id);
      const data = { title: p.title || ev.summary, date, time, kind, a: p.a, xp: P.XP[kind] };
      if (!t) S.tasks.push(Object.assign({ id, src: 'cal', gid: ev.id, st: 'open' }, data));
      else if (t.st === 'open') Object.assign(t, data, p.known ? {} : { kind: t.kind, a: t.a, xp: t.xp });
      else if (t.st === 'hidden') Object.assign(t, { date, time });
    }
    S.tasks = S.tasks.filter(x => x.src !== 'cal' || x.st === 'done' || seen.has(x.id));
    S.gcal.last = Date.now(); save(); renderSheet();
    if (interactive) toast(`Calendario sincronizado: ${n} eventos`);
  } catch (e) { if (interactive) toast(gErr(e)); }
  syncing = false;
}
function vGcal() {
  if (!S.gcal.cid) return `<h3>Google Calendar</h3><p class="mute">Pegá el ID de cliente de tu proyecto de Google Cloud. La guía paso a paso está en el README del repo.</p>
    <div class="row2"><input id="gcid" placeholder="xxxx.apps.googleusercontent.com" aria-label="ID de cliente de Google" autocomplete="off"><button class="ghost" id="gsave">Guardar</button></div>`;
  return `<h3>Google Calendar</h3><p class="mute">${S.gcal.last ? 'Última sincronización: ' + ago(S.gcal.last) + '.' : 'Todavía no sincronizaste.'} Trae tus eventos de hoy a 7 días como misiones. Poné "1", "2" o "3" al principio del título del evento para elegir el tipo.</p>
    <div class="btns"><button class="ghost" id="gsync">Sincronizar ahora</button><button class="ghost" id="gwrite" aria-pressed="${!!S.gcal.write}">Agendar lo que cargo: ${S.gcal.write ? 'Sí' : 'No'}</button></div>
    <button class="ghost" id="gforget">Desconectar</button>`;
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
  if (tab === 'misiones') {
    if (!$('#qaIn')) { $('#sheetBody').innerHTML = vMisShell(); qaOver = {}; }
    $('#agList').innerHTML = vAgenda(); $('#mapList').innerHTML = vMis(); $('#qaSug').innerHTML = vSug(); qaPreview();
    return;
  }
  $('#sheetBody').innerHTML = tab === 'stats' ? vStats() : vLogros();
}
const leftToday = () => { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); const s = (m - n) / 1000; return Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min'; };
const ORD = { c: 0, r: 1, e: 2 };

function vMis() {
  if (!S.missions.length) {
    const msg = !pos ? 'Esperando tu ubicación…' : fetching ? 'Buscando lugares cerca tuyo…' : S.poi ? 'No encontré lugares cerca. Probá moverte un poco.' : 'Todavía no pude cargar los lugares.';
    return `<p class="mute">${msg}</p>`;
  }
  const done = S.missions.filter(m => m.st === 'done').length;
  const ms = [...S.missions].sort((a, b) => (a.st === 'done') - (b.st === 'done') || ORD[a.rar] - ORD[b.rar]);
  return `<p class="mute">${done} de ${S.missions.length} cumplidas · vencen en ${leftToday()}</p>
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
  const cards = [['Nivel', L], ['XP total', S.xp], ['Km caminados', fmtKm(S.km)], ['Misiones', S.log.length], ['Lugares descubiertos', Object.keys(S.visited).length], ['Zonas pisadas', Object.keys(S.cells).length], ['Racha', streak() === 1 ? '1 día' : streak() + ' días'], ['De tu agenda', S.log.filter(x => x.type === 'agenda').length], ['Vencidas', S.expired]];
  return `<h2>Estadísticas</h2>
  <div class="grid">${cards.map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
  <h3>Últimos 7 días</h3>${rows(days.map(([l, x, k]) => [l, x, x + ' XP · ' + fmtKm(k)]), mxd, 'var(--coral)')}
  <h3>Atributos</h3>${Object.keys(D.ATTR).map(k => `<div class="row"><span>${D.ATTR[k]}</span><div class="bar" style="--c:${ACOL[k]}"><i style="width:${mxa ? (S.at[k] || 0) / mxa * 100 : 0}%"></i></div><span>${S.at[k] || 0} XP</span></div>`).join('')}
  <h3>Por tipo de lugar</h3>${rows(Object.keys(D.TYPES).map(k => [D.TYPES[k].n, bt[k] || 0, (bt[k] || 0) + ' misiones']), mxt, 'var(--blue)')}
  <h3>Por rareza</h3><p class="mute">Comunes ${br.c || 0} · Raras ${br.r || 0} · Épicas ${br.e || 0}</p>
  ${vGcal()}
  <h3>Skin</h3><div class="btns">${[['clasica', 'Clásica'], ['hacker', 'Hacker']].map(([k, n]) => `<button class="ghost skin" data-skin="${k}" aria-pressed="${(document.documentElement.dataset.skin || 'clasica') === k}">${n}</button>`).join('')}</div>
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
  ['Coleccionista', 'Descubrí 30 lugares distintos', () => [Object.keys(S.visited).length, 30]],
  ['Puntual', 'Cumplí 10 misiones de tu agenda a horario', () => [S.log.filter(x => x.type === 'agenda' && !x.late).length, 10]],
  ['Lo dije y lo hice', 'Cumplí 5 misiones principales de tu agenda', () => [S.log.filter(x => x.type === 'agenda' && x.kind === 'p').length, 5]]
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
  if (b.dataset.skin) return setSkin(b.dataset.skin);
  if (b.dataset.done) return completeTask(b.dataset.done);
  if (b.dataset.del) return removeTask(b.dataset.del);
  if (b.dataset.tkind) return cycleTask(b.dataset.tkind, 'kind');
  if (b.dataset.tattr) return cycleTask(b.dataset.tattr, 'a');
  if (b.dataset.cyc) { const p = P.parse($('#qaIn').value, new Date(), S.learn); if (b.dataset.cyc === 'kind') qaOver.kind = nextOf(CYC_K, qaOver.kind || p.kind); else qaOver.a = nextOf(CYC_A, qaOver.a || p.a); return qaPreview(); }
  if (b.dataset.sug) { const i = $('#qaIn'); i.value = b.dataset.sug + ' '; qaOver = {}; qaPreview(); i.focus(); return; }
  switch (b.id) {
    case 'here': {
      const m = S.missions.find(x => x.id === openM);
      if (!m) return;
      if (!inRange(m)) { toast('Todavía estás lejos. Acercate y probá de nuevo.'); renderModal(); return; }
      hold = Date.now(); renderModal(); break;
    }
    case 'closeM': closeModal(); break;
    case 'gsave': {
      const v = ($('#gcid').value || '').trim();
      if (!/\.apps\.googleusercontent\.com$/.test(v)) { toast('Ese no parece un ID de cliente de Google'); return; }
      S.gcal.cid = v; save(); renderSheet(); syncCal(true); break;
    }
    case 'gsync': case 'gsync2': syncCal(true); break;
    case 'gwrite': S.gcal.write = !S.gcal.write; save(); renderSheet(); break;
    case 'gforget': S.gcal = { cid: '', write: false, last: 0 }; gTok = null; try { sessionStorage.removeItem('lb-gtok'); } catch (err) { /* nada */ } S.tasks = S.tasks.filter(x => x.src !== 'cal' || x.st === 'done'); save(); renderSheet(); toast('Google Calendar desconectado'); break;
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
document.addEventListener('submit', e => {
  if (e.target.id !== 'qa') return;
  e.preventDefault();
  const i = $('#qaIn'), v = i.value.trim(); if (!v) return;
  addTask(v, qaOver); i.value = ''; qaOver = {}; qaPreview();
});
document.addEventListener('input', e => { if (e.target.id === 'qaIn') qaPreview(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openM) closeModal(); });

setInterval(() => { if (hold) tickHold(); }, 250);
setInterval(() => { dayCheck(); if (tab === 'misiones') renderSheet(); }, 60000);

/* ---------- arranque ---------- */
if (hacker()) document.querySelector('meta[name=theme-color]').content = '#020a04';
hud(); dayCheck(); draw();
if (S.gcal.cid && gTok) syncCal(false);
if (location.hash === '#demo') startDemo();
else if (S.intro) startGPS();
else $('#intro').hidden = false;
})();
