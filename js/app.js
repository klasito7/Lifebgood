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
const blank = () => ({ v: 1, intro: false, xp: 0, at: { F: 0, U: 0, C: 0, R: 0, E: 0 }, km: 0, kmDay: {}, xpDay: {}, log: [], visited: {}, cells: {}, day: null, missions: [], rerolls: 0, expired: 0, perfect: {}, poi: null, tasks: [], dailies: [], learn: {}, gcal: { cid: '', write: false, last: 0 }, disc: {}, wx: null, velez: null, duel: null, walks: [], walkOn: null, fx: { token: '', gist: null, ev: [], sent: 0, last: 0, err: '', lv: null }, found: {}, foundDay: {},
  fe: { v: 60, t: Date.now(), visits: 0, last: {} },
  body: { h: 177, w: [{ d: '2026-11-20', kg: 84 }], tdays: { '2026-11-19': 1 } },
  cloud: { gist: null, last: 0, err: '' },
  vtrain: { tricks: [{ id: 'circuito', n: 'Circuito en el patio' }, { id: 'kong', n: 'Buscar el Kong olfateando' }], ses: [] },
  heat: {}, act: null, lastAsk: 0, temper: '', mood: {}, album: 'Monte Grande', sumShown: '', upd: 0 });
let S = blank();
function load() { S = blank(); try { const r = localStorage.getItem(KEY); if (r) S = Object.assign(blank(), JSON.parse(r)); } catch (e) { /* sin almacenamiento */ } norm(); }
function norm() { const B = blank(); S.at = Object.assign({}, B.at, S.at); for (const k of ['fe', 'body', 'cloud', 'vtrain', 'heat', 'mood']) S[k] = Object.assign({}, B[k], S[k]); }
load();
const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* lleno o bloqueado */ } };
const save = () => { S.upd = Date.now(); saveLocal(); cloudSoon(); };

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
  discover(ll, acc); pickFinds(ll, acc); churchCheck(ll, acc); nearCheck(); loadWx(); loadVelez(); if (S.walkOn) walkUI();
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
    if (!vehiculo && d < 1500) { const t = today(); S.km += d / 1000; S.kmDay[t] = (S.kmDay[t] || 0) + d / 1000; walkTrack(ll, d); heatAdd(ll); }
  }
  last = { ll, t: now };
  save(); hud();
}

/* ---------- lugares de OpenStreetMap ---------- */
const classify = t => /^(kiosk|convenience)$/.test(t.shop || '') ? 'kiosco' : t.shop === 'bakery' ? 'panaderia' : t.leisure === 'park' ? 'plaza' : (t.amenity === 'ice_cream' || t.shop === 'ice_cream') ? 'heladeria' : t.shop === 'greengrocer' ? 'verduleria' : t.amenity === 'cafe' ? 'cafe' : t.amenity === 'place_of_worship' ? 'iglesia' : null;

async function fetchPOIs(ll) {
  // se consulta con el punto redondeado (~500 m) para no mandar tu ubicación exacta
  const c = [+(Math.round(ll[0] / 0.005) * 0.005).toFixed(3), +(Math.round(ll[1] / 0.005) * 0.005).toFixed(3)];
  const a = `(around:${QUERY_R},${c[0]},${c[1]})`;
  const q = `[out:json][timeout:25];(nwr["shop"~"^(kiosk|convenience)$"]${a};nwr["shop"="bakery"]${a};nwr["leisure"="park"]${a};nwr["amenity"="ice_cream"]${a};nwr["shop"="ice_cream"]${a};nwr["shop"="greengrocer"]${a};nwr["amenity"="cafe"]${a};nwr["amenity"="place_of_worship"]["religion"="christian"]${a};);out center 600;`;
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
  S.poi = { c, t: Date.now(), list, v: 2 };
  save();
}

async function ensurePOIs() {
  if (!pos || fetching) return;
  const stale = !S.poi || S.poi.v !== 2 || dist(S.poi.c, pos.ll) > 1000 || Date.now() - S.poi.t > 7 * 864e5;
  if (stale && Date.now() - failAt > 60000) {
    fetching = true; if (tab === 'misiones') renderSheet();
    try { await fetchPOIs(pos.ll); }
    catch (e) { failAt = Date.now(); toast('No pude cargar los lugares. Pruebo de nuevo en un minuto.'); }
    fetching = false;
  }
  if (S.poi && !S.day) gen(false);
  if (stale && S.poi && pos) { discover(pos.ll, pos.acc); churchCheck(pos.ll, pos.acc); }
  draw();
  if (tab === 'misiones') renderSheet();
}

/* ---------- misiones del día ---------- */
function mk(p, rar, R, t) {
  const T = D.TYPES[p.type], tp = T.t[Math.floor(R() * T.t.length)], nuevo = !S.visited[p.id] && !S.disc[p.id];
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
  if (S.found && Object.keys(S.found).length > 200) cleanFinds();
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
  for (const f of findsNear()) {
    L.marker(f.ll, { icon: L.divIcon({ className: 'lb-icon', html: `<div class="fd fd-${f.type}">${FDEF[f.type].g}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), title: FDEF[f.type].n })
      .on('click', () => { const d = pos ? dist(pos.ll, f.ll) : null; if (d != null && d <= FIND_R + Math.min(pos.acc, 25)) pick(f); else toast(`${FDEF[f.type].n}${d != null ? ' · a ' + fmtD(d) : ''}: caminá hasta ahí y se agarra sola`); }).addTo(layer);
  }
  const mis = new Set(S.missions.map(m => m.poi));
  for (const [id, v] of Object.entries(S.disc)) {
    if (mis.has(id) || !v.ll) continue;
    L.marker(v.ll, { icon: L.divIcon({ className: 'lb-icon', html: `<div class="pd">${D.TYPES[v.type].g}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }), title: v.name || D.TYPES[v.type].n, keyboard: false }).addTo(layer);
  }
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
function closeModal() { openM = null; hold = null; noteIdx = null; $('#modal').hidden = true; }
function renderModal() {
  const m = S.missions.find(x => x.id === openM);
  if (!m) return closeModal();
  const T = D.TYPES[m.type], d = pos ? dist(pos.ll, m.ll) : null, ok = inRange(m);
  const pr = hold ? Math.min(1, (Date.now() - hold) / holdMs()) : 0;
  let action;
  if (m.st === 'done') action = '<p class="okmsg">Misión cumplida</p>';
  else if (hold) action = `<div class="hold"><div class="bar"><i style="width:${pr * 100}%"></i></div><p>Quedate cerca… ${Math.ceil((1 - pr) * holdMs() / 1000)} s</p></div>`;
  else if (rainBlock(m)) action = '<button class="big" data-far="1" disabled>Llueve: la plaza espera</button>';
  else action = ok ? '<button class="big" id="here">Estoy acá</button>'
    : `<button class="big" id="here" data-far="1">${d == null ? 'Esperando GPS…' : 'Te faltan ' + fmtD(Math.max(0, d - T.r))}</button>`;
  $('#modalBody').innerHTML = `<div><span class="tag r-${m.rar}">${D.RAR[m.rar].n}</span><span class="tag">${T.n}</span>${m.nuevo ? '<span class="tag nw">Lugar nuevo</span>' : ''}</div>
    <h2>${esc(m.txt)}</h2>
    <p class="mute">${esc(m.name || T.n + ' sin nombre')}${d != null ? ' · a ' + fmtD(d) : ''}</p>
    <div class="rw"><span>+${m.st === 'done' ? m.got || m.xp : xpOf(m)} XP</span><span>${D.ATTR[m.a]}</span></div>
    ${m.st !== 'done' && (sunBonus(m) || xpMult() > 1) ? `<div>${sunBonus(m) ? '<span class="tag nw">x2 por sol</span>' : ''}${xpMult() > 1 ? '<span class="tag nw">x2 día de Vélez</span>' : ''}</div>` : ''}
    ${action}
    <a class="lnk" href="https://www.openstreetmap.org/?mlat=${m.ll[0]}&mlon=${m.ll[1]}#map=18/${m.ll[0]}/${m.ll[1]}" target="_blank" rel="noopener">Ver el lugar en OpenStreetMap</a>
    <button class="ghost" id="closeM">Cerrar</button>`;
}
function tickHold() {
  const m = S.missions.find(x => x.id === openM);
  if (!m) { hold = null; return; }
  if (!inRange(m, 10)) { hold = null; toast('Te alejaste: se cortó la captura'); renderModal(); return; }
  if (rainBlock(m)) { hold = null; toast('Empezó a llover: la plaza espera'); renderModal(); return; }
  if (Date.now() - hold >= holdMs()) complete(m); else renderModal();
}
const xpOf = m => m.xp * (sunBonus(m) ? 2 : 1) * xpMult();
function complete(m) {
  const before = lvl(S.xp).L, t = today(), xp = xpOf(m);
  m.st = 'done'; m.got = xp; hold = null;
  S.xp += xp; S.at[m.a] = (S.at[m.a] || 0) + xp;
  S.xpDay[t] = (S.xpDay[t] || 0) + xp;
  S.visited[m.poi] = { d: t, type: m.type };
  if (!S.disc[m.poi]) S.disc[m.poi] = { d: t, type: m.type, name: m.name, ll: m.ll };
  if (m.type === 'iglesia') feCharge();
  S.log.push({ t, h: nowHM(), type: m.type, rar: m.rar, a: m.a, xp, txt: m.txt, name: m.name });
  if (S.missions.every(x => x.st === 'done')) S.perfect[t] = 1;
  save(); draw(); hud(); renderSheet(); offerNote(S.log.length - 1);
  const L2 = lvl(S.xp).L;
  toast(L2 > before ? `¡Subiste a nivel ${L2}!` : `Misión cumplida: +${xp} XP`);
  try { navigator.vibrate && navigator.vibrate([60, 40, 140]); } catch (e) { /* sin vibración */ }
}

/* ---------- agenda: tus propias misiones (carga rápida o Google Calendar) ---------- */
const P = window.LB_PARSE;
const KN = { p: 'Principal', s: 'Secundaria', d: 'Diaria' };
const KNUM = { p: 1, s: 2, d: 3 };
const ACOLS = { F: 'var(--coral)', U: 'var(--blue)', C: 'var(--mint)', R: 'var(--cyan)', E: 'var(--gold)' };
const CYC_K = ['p', 's', 'd'], CYC_A = ['F', 'U', 'C', 'R', 'E'];
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

function completeTask(id, silent) {
  const t = S.tasks.find(x => x.id === id);
  if (!t || t.st !== 'open' || t.date !== today()) return;
  const before = lvl(S.xp).L, now = new Date();
  const late = !!t.time && Math.abs(now.getHours() * 60 + now.getMinutes() - minsOf(t.time)) > 60;
  const xp = (late ? Math.round(t.xp / 2) : t.xp) * xpMult(), d = today();
  t.st = 'done'; t.got = xp; t.late = late;
  S.xp += xp; S.at[t.a] = (S.at[t.a] || 0) + xp; S.xpDay[d] = (S.xpDay[d] || 0) + xp;
  S.log.push({ t: d, h: nowHM(), type: 'agenda', kind: t.kind, a: t.a, xp, txt: t.title, late });
  save(); hud(); renderSheet();
  if (silent) return;
  offerNote(S.log.length - 1);
  const L2 = lvl(S.xp).L;
  toast(L2 > before ? `¡Subiste a nivel ${L2}!` : late ? `Hecha fuera de horario: +${xp} XP` : `Misión cumplida: +${xp} XP`);
  try { navigator.vibrate && navigator.vibrate([60, 40, 140]); } catch (e) { /* sin vibración */ }
}
function removeTask(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  if (t.src === 'daily') { S.dailies = S.dailies.filter(d => d.id !== t.did); S.tasks = S.tasks.filter(x => x.did !== t.did || x.st === 'done'); toast('Diaria eliminada'); }
  else if (t.src === 'cal' || t.src === 'velez') { t.st = 'hidden'; toast(t.src === 'cal' ? 'Oculta (sigue en tu calendario)' : 'Oculta'); }
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

/* ---------- descubrir: cada lugar que pisás por primera vez queda en tu colección ---------- */
const nowHM = () => new Date().toTimeString().slice(0, 5);
function discover(ll, acc) {
  if (!S.poi || (acc > 30 && !demo)) return;
  const found = [];
  for (const p of S.poi.list) {
    if (S.disc[p.id]) continue;
    if (dist(ll, p.ll) <= D.TYPES[p.type].r) { S.disc[p.id] = { d: today(), type: p.type, name: p.name, ll: p.ll }; found.push(p); }
  }
  if (!found.length) return;
  const xp = 10 * found.length * xpMult(), t = today(), before = lvl(S.xp).L;
  S.xp += xp; S.at.U += xp; S.xpDay[t] = (S.xpDay[t] || 0) + xp;
  for (const p of found) S.log.push({ t, h: nowHM(), type: 'disc', ptype: p.type, a: 'U', xp: 10 * xpMult(), txt: 'Descubriste ' + (p.name || D.TYPES[p.type].n.toLowerCase() + ' sin nombre') });
  save(); hud(); draw(); renderSheet();
  const L2 = lvl(S.xp).L;
  toast(L2 > before ? `¡Subiste a nivel ${L2}!` : found.length === 1 ? `Descubriste: ${found[0].name || D.TYPES[found[0].type].n} (+${xp} XP)` : `Descubriste ${found.length} lugares (+${xp} XP)`);
}
function vDisc() {
  const list = S.poi ? S.poi.list : [];
  const tot = {}, got = {};
  for (const p of list) { tot[p.type] = (tot[p.type] || 0) + 1; if (S.disc[p.id]) got[p.type] = (got[p.type] || 0) + 1; }
  const all = list.length, mine = list.filter(p => S.disc[p.id]).length;
  return `<h3>Descubrimientos</h3><p class="mute">${mine} de ${all} lugares de tu zona (${all ? Math.round(mine / all * 100) : 0}%). Se descubren pasando por la puerta.</p>
  ${Object.keys(D.TYPES).filter(k => tot[k]).map(k => `<div class="row"><span>${D.TYPES[k].n}</span><div class="bar" style="--c:var(--mint)"><i style="width:${(got[k] || 0) / tot[k] * 100}%"></i></div><span>${got[k] || 0} / ${tot[k]}</span></div>`).join('')}`;
}

/* ---------- clima en vivo (Open-Meteo, gratis y sin cuenta) ---------- */
let wxBusy = false;
async function loadWx() {
  if (!pos || wxBusy) return;
  if (S.wx && Date.now() - S.wx.t < 30 * 60e3 && dist(S.wx.c, pos.ll) < 10000) return;
  wxBusy = true;
  try {
    const c = [+pos.ll[0].toFixed(2), +pos.ll[1].toFixed(2)]; // ~1 km de precisión, alcanza para el clima
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0]}&longitude=${c[1]}&current=temperature_2m,precipitation,weather_code,is_day&timezone=auto`);
    const j = await r.json(), k = j.current;
    S.wx = { t: Date.now(), c, temp: Math.round(k.temperature_2m), code: k.weather_code, rain: k.precipitation, day: k.is_day };
    save(); hud(); draw(); if (openM) renderModal(); renderSheet();
  } catch (e) { /* sin clima: el juego sigue igual */ }
  wxBusy = false;
}
function wxState() {
  if (!S.wx || Date.now() - S.wx.t > 3 * 3600e3) return null;
  const c = S.wx.code;
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95 || S.wx.rain > 0.2) return 'lluvia';
  if (c <= 1) return S.wx.day ? 'sol' : 'despejado';
  if (c === 45 || c === 48) return 'niebla';
  return 'nublado';
}
const WXN = { lluvia: 'Lluvia', sol: 'Sol', despejado: 'Despejado', niebla: 'Niebla', nublado: 'Nublado' };
const outdoor = type => type === 'plaza';
const rainBlock = m => outdoor(m.type) && wxState() === 'lluvia';
const sunBonus = m => outdoor(m.type) && wxState() === 'sol';

/* ---------- días de Vélez (fixture de ESPN, el mismo que usa FUNVS) ---------- */
let vzBusy = false;
async function loadVelez() {
  if (vzBusy || (S.velez && Date.now() - S.velez.t < 6 * 3600e3)) { velezDay(); return; }
  vzBusy = true;
  try {
    const base = 'https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams';
    const t = await (await fetch(base)).json();
    const team = (t.sports?.[0]?.leagues?.[0]?.teams || []).map(x => x.team).find(x => P.key(x.displayName || '').includes('velez'));
    if (!team) throw new Error('team');
    const j = await (await fetch(`${base}/${team.id}/schedule?fixture=true`)).json();
    const ms = (j.events || []).map(e => {
      const names = (e.competitions?.[0]?.competitors || []).map(x => x.team?.shortDisplayName || x.team?.displayName || '');
      return { id: e.id, date: e.date, rival: names.find(n => !P.key(n).includes('velez')) || 'su rival' };
    }).filter(m => m.date);
    S.velez = { t: Date.now(), ms };
  } catch (e) { S.velez = { t: Date.now() - 5 * 3600e3, ms: S.velez ? S.velez.ms : [] }; } // reintenta en 1 hora
  vzBusy = false; save(); velezDay(); hud();
}
const velezToday = () => (S.velez ? S.velez.ms : []).find(m => dayKey(new Date(m.date)) === today());
const xpMult = () => velezToday() ? 2 : 1;
function velezDay() {
  const m = velezToday(); if (!m) return;
  const id = 'v:' + m.id;
  if (S.tasks.some(x => x.id === id)) return;
  S.tasks.push({ id, src: 'velez', title: `Ver Vélez vs ${m.rival}`, kind: 'p', a: 'C', date: today(), time: new Date(m.date).toTimeString().slice(0, 5), xp: P.XP.p, st: 'open' });
  save(); renderSheet(); toast('Hoy juega Vélez: todo da XP doble');
}

/* ---------- racha con escudo: 1 día de perdón por semana ---------- */
const weekKey = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); };
function streakInfo() {
  const used = new Set(); let n = 0; const d = new Date();
  if (!S.xpDay[dayKey(d)]) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 800; i++) {
    if (S.xpDay[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); continue; }
    const w = weekKey(d), prev = new Date(d); prev.setDate(prev.getDate() - 1);
    if (!used.has(w) && S.xpDay[dayKey(prev)]) { used.add(w); d.setDate(d.getDate() - 1); continue; }
    break;
  }
  return { n, shieldUsed: used.has(weekKey(new Date())) };
}
function streak() { return streakInfo().n; }

/* ---------- diario de misión ---------- */
let noteIdx = null;
// después de cumplir algo: una barrita que ofrece anotar, sin frenar nada
let snT = null;
function offerNote(i) {
  if (openM) closeModal();
  const e = S.log[i]; if (!e) return;
  $('#snack').innerHTML = `<span>¿Querés anotar qué pasó?</span><button data-note="${i}">Anotar en el diario</button>`;
  $('#snack').hidden = false; clearTimeout(snT); snT = setTimeout(() => { $('#snack').hidden = true; }, 7000);
}
function askNote(i) {
  const e = S.log[i]; if (!e) return;
  noteIdx = i; openM = null; hold = null;
  $('#modalBody').innerHTML = `<p class="okmsg">${e.type === 'duel' ? 'Reto del duelo' : 'Misión cumplida'} · +${e.xp} XP</p>
    <h2>${esc(e.txt)}</h2>
    <label class="mute" for="note">Diario: ¿qué pasó? Una línea alcanza.</label>
    <textarea id="note" maxlength="280" rows="3" placeholder="Ej.: el kiosquero se llama Rubén y me recomendó un alfajor de Mar del Plata">${esc(e.note || '')}</textarea>
    <button class="big" id="noteSave">Guardar en el diario</button>
    <button class="ghost" id="closeM">${e.note ? 'Cerrar' : 'Saltar'}</button>`;
  $('#modal').hidden = false;
}
const LBL = t => t === 'agenda' ? 'Agenda' : t === 'duel' ? 'Duelo' : t === 'vaca' ? 'Vaca' : D.TYPES[t] ? D.TYPES[t].n : '';
function vDiario() {
  const items = S.log.map((e, i) => [e, i]).filter(([e]) => e.type !== 'disc' && e.type !== 'find').reverse();
  if (!items.length) return '<h2>Diario</h2><p class="mute">Cuando cumplas una misión, acá queda lo que pasó.</p>';
  const days = new Map();
  for (const it of items) { const k = it[0].t; if (!days.has(k)) days.set(k, []); days.get(k).push(it); }
  const discN = d => S.log.filter(e => e.type === 'disc' && e.t === d).length;
  return '<h2>Diario</h2>' + [...days].map(([d, arr]) => `<h3>${new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
    ${discN(d) ? `<p class="mute">${discN(d)} lugar${discN(d) > 1 ? 'es' : ''} descubierto${discN(d) > 1 ? 's' : ''}</p>` : ''}
    <ul class="dl">${arr.map(([e, i]) => `<li class="de"><div class="dh"><span class="tag">${LBL(e.type)}</span>${e.h ? `<span class="mute">${e.h}</span>` : ''}<span class="mute">+${e.xp} XP</span></div>
      <b>${esc(e.txt)}</b>${e.name ? `<small>${esc(e.name)}</small>` : ''}
      ${e.note ? `<p class="dn">${esc(e.note)}</p><button class="lnkb" data-note="${i}">Editar</button>` : `<button class="lnkb" data-note="${i}">Escribir qué pasó</button>`}</li>`).join('')}</ul>`).join('');
}

/* ---------- duelo semanal con un amigo (sin servidor: se pasan códigos) ---------- */
// Retos pensados para crecer, no para hacer el ridículo. Los "auto" los verifica la app; en los "nota" la prueba es lo que escribís, y tu rival la lee.
const RETOS = [
  { id: 'a1', auto: 'km', n: 15, pts: 2, t: 'Caminá 15 km en la semana' },
  { id: 'a2', auto: 'disc', n: 10, pts: 2, t: 'Descubrí 10 lugares nuevos en la semana' },
  { id: 'a3', auto: 'epic', n: 1, pts: 2, t: 'Cumplí una misión épica' },
  { id: 'a4', auto: 'days', n: 7, pts: 3, t: 'Sumá XP los 7 días de la semana' },
  { id: 'a5', auto: 'punct', n: 5, pts: 2, t: 'Cumplí 5 misiones principales de tu agenda a horario' },
  { id: 'a6', auto: 'kmday', n: 5, pts: 2, t: 'Caminá 5 km en un solo día' },
  { id: 'n1', pts: 3, t: 'Encontrá en tu barrio algo con más de 50 años (una casa, un árbol, un negocio) y averiguá su historia' },
  { id: 'n2', pts: 3, t: 'Conversá 10 minutos con alguien mayor de 70 y anotá el mejor consejo que te dé' },
  { id: 'n3', pts: 2, t: 'Compará el precio de un mismo producto en 3 negocios distintos y anotá la diferencia' },
  { id: 'n4', pts: 2, t: 'Cociná algo que nunca hiciste, solo con cosas de la verdulería y el almacén' },
  { id: 'n5', pts: 2, t: 'Grabate 1 minuto explicando algo que sabés, sin muletillas. Anotá cuántos intentos te llevó' },
  { id: 'n6', pts: 2, t: 'Pasá un día entero sin redes sociales y anotá en qué usaste ese tiempo' },
  { id: 'n7', pts: 2, t: 'Aprendé algo práctico que no sabías (un nudo, RCP, cambiar una cubierta) y explicalo en 2 frases' },
  { id: 'n8', pts: 1, t: 'Leé un capítulo de un libro y resumilo en 3 frases' },
  { id: 'n9', pts: 2, t: 'Hacé 100 flexiones en un día, en las series que quieras. Anotá cómo las repartiste' },
  { id: 'n10', pts: 2, t: 'Llegá caminando al punto más alto de tu zona y describí qué se ve desde ahí' },
  { id: 'n11', pts: 2, t: 'Ayudá a alguien con algo concreto sin que te lo pida, y no se lo cuentes a nadie (solo acá)' },
  { id: 'n12', pts: 3, t: 'Escribí a mano una carta a alguien importante y entregala' },
  { id: 'n13', pts: 1, t: 'Hacé tu mejor marca de plancha y anotá el tiempo' },
  { id: 'n14', pts: 2, t: 'Desayuná sin celular 5 días de la semana y anotá qué cambió' }
];
const weekDays = wk => [...Array(7)].map((_, i) => { const d = new Date(wk + 'T12:00'); d.setDate(d.getDate() + i); return dayKey(d); });
function duelRetos(code) {
  const R = rng(hash(code));
  const pick = (arr, n) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  return [...pick(RETOS.filter(r => r.auto), 2), ...pick(RETOS.filter(r => !r.auto), 3)];
}
function autoVal(r, wk) {
  const ds = new Set(weekDays(wk));
  const inW = e => ds.has(e.t);
  switch (r.auto) {
    case 'km': return [...ds].reduce((s, d) => s + (S.kmDay[d] || 0), 0);
    case 'kmday': return Math.max(0, ...[...ds].map(d => S.kmDay[d] || 0));
    case 'disc': return Object.values(S.disc).filter(v => ds.has(v.d)).length;
    case 'epic': return S.log.filter(e => inW(e) && e.rar === 'e').length;
    case 'days': return [...ds].filter(d => S.xpDay[d]).length;
    case 'punct': return S.log.filter(e => inW(e) && e.type === 'agenda' && e.kind === 'p' && !e.late).length;
  }
  return 0;
}
const fmtVal = (r, v) => r.auto === 'km' || r.auto === 'kmday' ? fmtKm(v) : String(v);
function duelDone(r) { const du = S.duel; return r.auto ? autoVal(r, du.week) >= r.n : !!(du.notes[r.id] && du.notes[r.id].trim().length >= 10); }
const duelPts = () => duelRetos(S.duel.code).reduce((s, r) => s + (duelDone(r) ? r.pts : 0), 0);
const duelXP = () => weekDays(S.duel.week).reduce((s, d) => s + (S.xpDay[d] || 0), 0);
const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
function newDuel(code) {
  const m = /^LB-(\d{8})-[A-Z0-9]{4,}$/.exec(code);
  if (!m) return toast('Ese código no es de un duelo de Lifebgood');
  const wk = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`;
  S.duel = { code, week: wk, notes: {}, name: (S.duel && S.duel.name) || '', rival: null, paid: {} };
  save(); renderSheet(); toast('Duelo listo: pasale el código a tu rival');
}
function myResult() {
  const du = S.duel, rs = duelRetos(du.code);
  return 'LBR.' + b64e({ c: du.code, n: du.name || 'Jugador', d: rs.filter(duelDone).map(r => r.id), x: duelXP(), notes: Object.fromEntries(rs.filter(r => !r.auto && duelDone(r)).map(r => [r.id, du.notes[r.id].slice(0, 280)])) });
}
function vDuelo() {
  const du = S.duel;
  const curWk = weekKey(new Date());
  const head = `<h2>Duelo de la semana</h2><p class="mute">Los dos usan el mismo código y reciben los mismos 5 retos. El domingo a la noche se pasan el resultado y gana el que suma más puntos. Si empatan, desempata la XP de la semana.</p>`;
  if (!du || du.week < curWk) return head + `<button class="big" id="dNew">Crear duelo nuevo</button>
    <h3>¿Te pasaron un código?</h3><div class="row2"><input id="dCode" placeholder="LB-20261116-XXXX" autocomplete="off" aria-label="Código de duelo"><button class="ghost" id="dJoin">Unirme</button></div>
    ${du ? `<p class="mute">Tu duelo anterior (${fmtDay(du.week)}) ya terminó.</p>` : ''}`;
  const rs = duelRetos(du.code), riv = du.rival;
  const rowR = r => {
    const ok = duelDone(r), rok = riv && riv.d.includes(r.id);
    return `<li class="re ${ok ? 'ok' : ''}"><div class="dh"><span class="tag">${r.pts} pt${r.pts > 1 ? 's' : ''}</span><span class="tag">${r.auto ? 'La app lo verifica' : 'Escribís la prueba'}</span>${riv ? `<span class="tag ${rok ? 'nw' : ''}">${esc(riv.n)}: ${rok ? 'hecho' : 'pendiente'}</span>` : ''}</div>
      <b>${ok ? '✓ ' : ''}${esc(r.t)}</b>
      ${r.auto ? `<div class="row"><span>Llevás</span><div class="bar" style="--c:var(--mint)"><i style="width:${Math.min(100, autoVal(r, du.week) / r.n * 100)}%"></i></div><span>${fmtVal(r, autoVal(r, du.week))} / ${r.auto.startsWith('km') ? fmtKm(r.n) : r.n}</span></div>`
        : `<textarea class="dnote" data-dnote="${r.id}" maxlength="280" rows="2" placeholder="Contá qué hiciste (mínimo una frase)">${esc(du.notes[r.id] || '')}</textarea>`}
      ${riv && riv.notes && riv.notes[r.id] ? `<p class="dn"><b>${esc(riv.n)}:</b> ${esc(riv.notes[r.id])}</p>` : ''}</li>`;
  };
  const myP = duelPts(), rivP = riv ? rs.filter(r => riv.d.includes(r.id)).reduce((s, r) => s + r.pts, 0) : null;
  const verdict = riv ? (myP !== rivP ? (myP > rivP ? 'Vas ganando' : `Va ganando ${esc(riv.n)}`) : duelXP() !== riv.x ? (duelXP() > riv.x ? 'Empate en puntos: ganás por XP' : `Empate en puntos: gana ${esc(riv.n)} por XP`) : 'Empate total') : '';
  return head + `<div class="duelhd"><div><span class="mute">Código</span><b class="code">${esc(du.code)}</b></div><button class="ghost slim" id="dCopyCode">Copiar código</button></div>
    <div class="row2"><input id="dName" value="${esc(du.name)}" placeholder="Tu apodo en el duelo" maxlength="20" aria-label="Tu apodo en el duelo"></div>
    <div class="score"><div><span class="mute">Vos</span><b>${myP} pts</b><small>${duelXP()} XP en la semana</small></div>${riv ? `<div><span class="mute">${esc(riv.n)}</span><b>${rivP} pts</b><small>${riv.x} XP en la semana</small></div>` : ''}</div>
    ${verdict ? `<p class="okmsg">${verdict}</p>` : ''}
    <ul class="dl">${rs.map(rowR).join('')}</ul>
    <h3>Pasar resultados</h3>
    <p class="mute">Copiá tu resultado y mandáselo. Pegá acá el suyo para compararlos (podés hacerlo varias veces en la semana).</p>
    <button class="ghost" id="dCopyRes">Copiar mi resultado</button>
    <div class="row2" style="margin-top:8px"><input id="dRival" placeholder="Pegá el resultado de tu rival (LBR.…)" autocomplete="off" aria-label="Resultado del rival"><button class="ghost" id="dLoad">Comparar</button></div>
    <button class="ghost" id="dNew">Empezar otro duelo</button>`;
}
const RATTR = { a1: 'R', a2: 'U', a3: 'R', a4: 'R', a5: 'R', a6: 'R', n2: 'C', n5: 'C', n11: 'C', n12: 'C', n9: 'F', n13: 'F' };
function duelPay() {
  const du = S.duel; if (!du || du.week < weekKey(new Date())) return;
  du.paid = du.paid || {};
  const t = today(); let gained = 0;
  for (const r of duelRetos(du.code)) {
    if (du.paid[r.id] || !duelDone(r)) continue;
    const xp = r.pts * 30 * xpMult(), a = RATTR[r.id] || 'U';
    du.paid[r.id] = 1; S.xp += xp; S.at[a] = (S.at[a] || 0) + xp; S.xpDay[t] = (S.xpDay[t] || 0) + xp;
    S.log.push({ t, h: nowHM(), type: 'duel', a, xp, txt: r.t, note: r.auto ? undefined : du.notes[r.id] });
    gained += xp;
  }
  if (gained) { save(); hud(); toast(`Reto del duelo cumplido: +${gained} XP`); }
}
async function copyText(t, ok) {
  try { await navigator.clipboard.writeText(t); toast(ok); }
  catch (e) { const i = document.createElement('textarea'); i.value = t; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); toast(ok); } catch (er) { toast('No pude copiar: seleccionalo a mano'); } i.remove(); }
}

/* ---------- paseos con Vaca: con GPS en vivo o cargados a mano ---------- */
const VPAL = { c: '#b8642a', l: '#d98a4a', n: '#151515', e: '#3a1d0a', w: '#f2e6da', m: '#8a7da0' };
const VACA = ['..........c...', '.........cccc.', '........ccecll', 'c.......ccccln', '.c.....mmcccl.', '..ccccccccccw.', '..cccccccccww.', '..cc.cc..cc...', '..cc.cc..cc...', '..ee.ee..ee...'];
const vacaSprite = () => `<svg viewBox="0 0 14 10" shape-rendering="crispEdges" width="100%" height="100%" aria-hidden="true">${VACA.map((r, y) => [...r].map((c, x) => c === '.' ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${VPAL[c]}"/>`).join('')).join('')}</svg>`;
const vacaMk = L.marker(DEMO_POS, { icon: L.divIcon({ className: 'lb-icon', html: `<div class="vaca-in">${vacaSprite()}</div>`, iconSize: [31, 22], iconAnchor: [-6, 20] }), zIndexOffset: 900, interactive: false, keyboard: false });
const walkLine = L.polyline([], { color: '#d98a4a', weight: 4, opacity: .85, interactive: false });
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* el celu no lo permite: seguimos igual */ }
}
document.addEventListener('visibilitychange', () => { if (S.walkOn && document.visibilityState === 'visible') keepAwake(true); });

const walkXP = (min, km, manual) => manual ? Math.min(90, 30 + Math.floor(min / 10) * 5) : Math.min(150, 40 + Math.floor(min / 10) * 10 + Math.floor(km * 10) * 2);
const fmtMin = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;

function startWalk() {
  if (S.walkOn) return;
  S.walkOn = { start: Date.now(), km: 0, path: pos ? [pos.ll] : [] };
  save(); keepAwake(true); walkUI(); closeModal();
  toast('Arrancó el paseo con Vaca');
}
function walkTrack(ll, d) { // lo llama track() con cada tramo caminado
  if (!S.walkOn) return;
  S.walkOn.km += d / 1000;
  S.walkOn.path.push(ll); if (S.walkOn.path.length > 2000) S.walkOn.path.splice(1, 1);
}
function finishWalk(discard) {
  const w = S.walkOn; if (!w) return;
  S.walkOn = null; keepAwake(false);
  const min = Math.round((Date.now() - w.start) / 60000);
  if (discard || min < 5) { save(); walkUI(); toast(discard ? 'Paseo descartado' : 'Muy cortito: para contar tiene que durar 5 minutos'); return; }
  saveWalk({ start: w.start, min, km: +w.km.toFixed(2), src: 'gps' });
}
function saveWalk(wk) {
  const d = dayKey(new Date(wk.start)), before = lvl(S.xp).L;
  const xp = walkXP(wk.min, wk.km, wk.src === 'manual') * xpMult();
  S.walks.push(Object.assign({ id: uid(), d }, wk));
  fxAdd({ id: 'w' + wk.start, ty: 'walk', s: wk.start, min: wk.min, km: wk.km || 0 });
  S.xp += xp; S.at.R += xp; S.xpDay[d] = (S.xpDay[d] || 0) + xp;
  const li = S.log.length;
  S.log.push({ t: d, h: new Date(wk.start).toTimeString().slice(0, 5), type: 'vaca', a: 'R', xp, txt: `Paseo con Vaca · ${fmtMin(wk.min)}${wk.km ? ' · ' + fmtKm(wk.km) : ''}${wk.src === 'manual' ? ' (cargado a mano)' : ''}` });
  // si en la agenda de hoy había "pasear a Vaca", queda cumplida sola
  if (d === today()) {
    const t = S.tasks.find(x => x.date === d && x.st === 'open' && /vaca|pase/.test(P.key(x.title)));
    if (t) completeTask(t.id, true);
  }
  save(); hud(); walkUI(); renderSheet(); offerNote(li);
  const L2 = lvl(S.xp).L;
  toast(L2 > before ? `¡Subiste a nivel ${L2}!` : `Paseo registrado: +${xp} XP`);
}
$('#vacaIco').innerHTML = vacaSprite();
function walkUI() {
  const w = S.walkOn, bar = $('#walkBar');
  bar.hidden = !w;
  if (w) {
    const s = Math.floor((Date.now() - w.start) / 1000);
    $('#walkTxt').textContent = `Paseando con Vaca · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${fmtKm(w.km)}`;
    if (pos) { if (!map.hasLayer(vacaMk)) vacaMk.addTo(map); vacaMk.setLatLng(pos.ll); }
    if (!map.hasLayer(walkLine)) walkLine.addTo(map);
    walkLine.setLatLngs(w.path);
  } else { if (map.hasLayer(vacaMk)) map.removeLayer(vacaMk); if (map.hasLayer(walkLine)) map.removeLayer(walkLine); }
}
function walkMenu() {
  openM = null; hold = null; noteIdx = null;
  const now = nowHM();
  $('#modalBody').innerHTML = `<div class="vaca-big">${vacaSprite()}</div><h2>Paseo con Vaca</h2>
    <p class="mute">Con GPS cuenta minutos y kilómetros, y da más XP. Dejá la app abierta durante el paseo: el celu no apaga la pantalla mientras dura.</p>
    <button class="big" id="walkGo">Empezar paseo</button>
    <h3>¿Ya la sacaste? Cargalo a mano</h3>
    <div class="tags" id="wMins">${[15, 20, 30, 45, 60].map(m => `<button type="button" class="tag tb" data-wmin="${m}" aria-pressed="${m === 30}">${m} min</button>`).join('')}</div>
    <div class="row2" style="margin-top:6px"><label class="mute" for="wHora" style="align-self:center;margin:0">Hora</label><input id="wHora" type="time" value="${now}"><button class="ghost" id="walkManual">Cargar</button></div>
    <button class="ghost" id="closeM">Cerrar</button>`;
  $('#modal').hidden = false;
}
function vVaca() {
  const wk = weekDays(weekKey(new Date()));
  const thisW = S.walks.filter(w => wk.includes(w.d));
  let n = 0; const d = new Date(); if (!S.walks.some(w => w.d === dayKey(d))) d.setDate(d.getDate() - 1);
  while (S.walks.some(w => w.d === dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  const days = [...Array(7)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() - 6 + i); const k = dayKey(x); const ws = S.walks.filter(w => w.d === k); return [x.toLocaleDateString('es-AR', { weekday: 'short' }), ws.reduce((s, w) => s + w.min, 0), ws.length]; });
  const mx = Math.max(...days.map(x => x[1]));
  return `<h3>Vaca</h3><div class="grid">
    <div class="st"><span>Paseos esta semana</span><b>${thisW.length}</b></div>
    <div class="st"><span>Racha de paseos</span><b>${n === 1 ? '1 día' : n + ' días'}</b></div>
    <div class="st"><span>Km con Vaca</span><b>${fmtKm(S.walks.reduce((s, w) => s + (w.km || 0), 0))}</b></div>
    <div class="st"><span>Tiempo total</span><b>${fmtMin(S.walks.reduce((s, w) => s + w.min, 0))}</b></div></div>
    ${rows(days.map(([l, m, c]) => [l, m, c ? `${c} · ${m} min` : '—']), mx, 'var(--gold)')}
    <button class="ghost" id="walkMenu2">Pasear o cargar un paseo</button>`;
}

/* ---------- puente con FUNVS: Lifebgood deja lo que ganaste en el Gist de la Colección ---------- */
// FUNVS lo lee al sincronizar. Cada cosa tiene un id único, así que nunca entra dos veces.
function hubData() { try { return JSON.parse(localStorage.getItem('hub2') || 'null'); } catch (e) { return null; } } // FUNVS abierto en este mismo navegador
const fxToken = () => S.fx.token || (hubData() && hubData().sync && hubData().sync.token) || '';
const fxAutoTok = () => !S.fx.token && !!fxToken();
async function ghApi(path, opt) {
  const r = await fetch('https://api.github.com' + path, Object.assign({}, opt, { headers: { Authorization: 'Bearer ' + fxToken(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } }));
  if (!r.ok) { const e = new Error('gh' + r.status); e.status = r.status; throw e; }
  return r.json();
}
async function fxGist() {
  if (S.fx.gist) return S.fx.gist;
  const h = hubData(); if (h && h.figusGist) { S.fx.gist = h.figusGist; save(); return S.fx.gist; }
  for (let p = 1; p <= 3; p++) {
    const L0 = await ghApi(`/gists?per_page=100&page=${p}`);
    const g = L0.find(x => x.files && x.files['figus.json']);
    if (g) { S.fx.gist = g.id; save(); return g.id; }
    if (L0.length < 100) break;
  }
  const e = new Error('nogist'); e.status = 'nogist'; throw e;
}
function fxAdd(e) {
  e.id = e.id || uid() + Date.now().toString(36); e.t = e.t || Date.now();
  if (S.fx.ev.some(x => x.id === e.id)) return;
  S.fx.ev.push(e); if (S.fx.ev.length > 500) S.fx.ev = S.fx.ev.slice(-500);
  save(); fxSchedule();
}
let fxT = null, fxBusy = false;
function fxSchedule() { if (!fxToken()) return; clearTimeout(fxT); fxT = setTimeout(() => fxPush(false), 15000); }
async function fxPush(interactive) {
  if (!fxToken()) { if (interactive) toast('Falta conectar FUNVS'); return; }
  if (fxBusy) return; fxBusy = true; clearTimeout(fxT); fxT = null;
  try {
    const id = await fxGist();
    await ghApi('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: { 'lifebgood.json': { content: JSON.stringify({ v: 1, app: 'Lifebgood', updatedAt: Date.now(), ev: S.fx.ev }) } } }) });
    S.fx.last = Date.now(); S.fx.sent = S.fx.ev.length; S.fx.err = ''; save();
    if (interactive) toast('Enviado a FUNVS: se suma al abrir la Colección');
  } catch (e) {
    S.fx.err = e.status === 401 ? 'El token no sirve o se venció' : e.status === 'nogist' ? 'No encontré la Colección de FUNVS en ese GitHub' : e.status === 403 || e.status === 404 ? 'El token no tiene permiso de "gist"' : 'Sin conexión con GitHub';
    save(); if (interactive) toast(S.fx.err);
  }
  fxBusy = false; if (tab === 'stats') renderSheet();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && fxT) fxPush(false); });
const fxPending = () => S.fx.ev.length - (S.fx.sent || 0);
function vFunvs() {
  const vc = S.fx.ev.filter(e => e.ty === 'coins').reduce((s, e) => s + e.n, 0), sob = S.fx.ev.filter(e => e.ty === 'sobre').length, pas = S.fx.ev.filter(e => e.ty === 'walk').length;
  const head = `<h3>FUNVS</h3><p class="mute">Lo que ganás acá (vaccoins de hallazgos y niveles, sobres y paseos de Vaca) va a tu Colección de FUNVS. Hasta ahora: ${vc} vaccoins, ${sob} sobre${sob === 1 ? '' : 's'} y ${pas} paseo${pas === 1 ? '' : 's'}.</p>`;
  if (!fxToken()) return head + `<p class="mute">Pegá el mismo token de GitHub que usás en FUNVS para sincronizar (permiso "gist"). Queda guardado solo en este navegador.</p>
    <div class="row2"><input id="fxTok" type="password" placeholder="ghp_… o github_pat_…" autocomplete="off" aria-label="Token de GitHub"><button class="ghost" id="fxSave">Conectar</button></div>`;
  return head + `<p class="mute">${fxAutoTok() ? 'Conectado con el token de FUNVS de este navegador. ' : 'Conectado. '}${S.fx.err ? '⚠ ' + esc(S.fx.err) : S.fx.last ? 'Último envío: ' + ago(S.fx.last) + '.' : 'Todavía no se envió nada.'}${fxPending() > 0 ? ` ${fxPending()} cosa${fxPending() > 1 ? 's' : ''} por enviar.` : ''}</p>
    <div class="btns"><button class="ghost" id="fxSend">Enviar ahora</button>${S.fx.token ? '<button class="ghost" id="fxForget">Quitar token</button>' : ''}</div>`;
}
// cada nivel nuevo: 50 vaccoins para FUNVS
function fxLevels() {
  const L0 = lvl(S.xp).L;
  if (S.fx.lv == null) { S.fx.lv = L0; save(); return; }
  for (let l = S.fx.lv + 1; l <= L0; l++) fxAdd({ id: 'lv' + l, ty: 'coins', n: 50, why: `Subiste a nivel ${l}` });
  if (L0 > S.fx.lv) { S.fx.lv = L0; save(); }
}

/* ---------- hallazgos: cosas que aparecen por la calle y se agarran caminando ---------- */
const SLOT = 30 * 60e3, CELL = 0.004, FIND_R = 40, FIND_CAP = 25;
const FDEF = {
  bolsa: { n: 'Bolsa de vaccoins', g: 'V', w: 50 },
  energia: { n: 'Energía', g: '+', w: 20 },
  cofre: { n: 'Cofre', g: '▣', w: 13 },
  grande: { n: 'Bolsa grande', g: 'V', w: 8 },
  vaca: { n: 'Sobre de Vaca', g: 'S', w: 9 },
  velez: { n: 'Sobre de Vélez', g: 'S', w: 0 }
};
function findsNear() {
  if (!pos) return [];
  const t = today(); if ((S.foundDay[t] || 0) >= FIND_CAP) return [];
  const slot = Math.floor(Date.now() / SLOT), ci = Math.floor(pos.ll[0] / CELL), cj = Math.floor(pos.ll[1] / CELL), out = [];
  const W = Object.entries(FDEF).map(([k, v]) => [k, k === 'velez' ? (xpMult() > 1 ? 8 : 0) : k === 'grande' && xpMult() > 1 ? 0 : v.w]);
  const tot = W.reduce((s, x) => s + x[1], 0);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const a = ci + di, b = cj + dj, R = rng(hash(`${a}:${b}:${slot}`));
    const near = S.poi ? S.poi.list.filter(p => Math.floor(p.ll[0] / CELL) === a && Math.floor(p.ll[1] / CELL) === b) : [];
    const n = 2 + (R() < .4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      let ll;
      if (near.length && R() < .6) { const p = near[Math.floor(R() * near.length)]; ll = [p.ll[0] + (R() - .5) * .00025, p.ll[1] + (R() - .5) * .0003]; } // cerca de un negocio: siempre se llega
      else ll = [(a + R()) * CELL, (b + R()) * CELL];
      let x = R() * tot, type = 'bolsa';
      for (const [k2, w] of W) { if ((x -= w) < 0) { type = k2; break; } }
      out.push({ id: `${a}:${b}:${slot}:${k}`, ll, type, val: 5 + Math.floor(R() * 11) });
    }
  }
  return out.filter(f => !S.found[f.id]);
}
function pickFinds(ll, acc) {
  if (acc > 40 && !demo) return;
  for (const f of findsNear()) if (dist(ll, f.ll) <= FIND_R + Math.min(acc, 25)) pick(f);
}
function pick(f) {
  if (S.found[f.id]) return;
  const t = today(), before = lvl(S.xp).L;
  if ((S.foundDay[t] || 0) >= FIND_CAP) return;
  S.found[f.id] = Date.now(); S.foundDay[t] = (S.foundDay[t] || 0) + 1;
  const m = xpMult();
  const R0 = { bolsa: [f.val, 3], energia: [0, 20], cofre: [20, 30], grande: [25, 8], vaca: [0, 15], velez: [0, 15] }[f.type];
  const vc = R0[0], xp = R0[1] * m;
  S.xp += xp; S.at.R += xp; S.xpDay[t] = (S.xpDay[t] || 0) + xp;
  if (vc) fxAdd({ id: 'f' + f.id, ty: 'coins', n: vc, why: FDEF[f.type].n });
  if (f.type === 'vaca' || f.type === 'velez') fxAdd({ id: 'f' + f.id, ty: 'sobre', k: f.type });
  S.log.push({ t, h: nowHM(), type: 'find', ftype: f.type, a: 'R', xp, vc, txt: FDEF[f.type].n });
  save(); hud(); draw(); renderSheet();
  const L2 = lvl(S.xp).L;
  toast(L2 > before ? `¡Subiste a nivel ${L2}!` : `Encontraste: ${FDEF[f.type].n}${vc ? ` (+${vc} vaccoins)` : ''}${f.type === 'vaca' || f.type === 'velez' ? ' para FUNVS' : ''} · +${xp} XP`);
  try { navigator.vibrate && navigator.vibrate([30, 30, 30, 30, 90]); } catch (e) { /* sin vibración */ }
}
function cleanFinds() { const lim = Date.now() - 2 * 864e5; for (const [k, v] of Object.entries(S.found)) if (v < lim) delete S.found[k]; }

/* ---------- utilidades compartidas ---------- */
function grant(xp, a, entry) {
  const t = today(), before = lvl(S.xp).L;
  S.xp += xp; S.at[a] = (S.at[a] || 0) + xp; S.xpDay[t] = (S.xpDay[t] || 0) + xp;
  const i = S.log.push(Object.assign({ t, h: nowHM(), a, xp }, entry)) - 1;
  save(); hud(); renderSheet();
  const L2 = lvl(S.xp).L;
  return { i, up: L2 > before ? L2 : 0 };
}

/* ---------- aviso flotante que aparece y se va (no frena nada) ---------- */
let popT = null, popAct = null;
function showPop(html, ms, onTap) {
  const el = $('#pop');
  el.innerHTML = html; el.hidden = false; el.classList.remove('out');
  popAct = onTap || null;
  clearTimeout(popT); if (ms) popT = setTimeout(hidePop, ms);
}
function hidePop() { const el = $('#pop'); el.classList.add('out'); clearTimeout(popT); popT = setTimeout(() => { el.hidden = true; el.style.transform = ''; el.style.opacity = ''; }, 250); }
// deslizar para ocultar (a los costados o hacia abajo)
let sw = null, swMoved = false;
$('#pop').addEventListener('pointerdown', e => { if (e.target.closest('button')) return; sw = { x: e.clientX, y: e.clientY }; swMoved = false; $('#pop').style.transition = 'none'; });
window.addEventListener('pointermove', e => {
  if (!sw) return;
  const dx = e.clientX - sw.x, dy = Math.max(0, e.clientY - sw.y);
  if (Math.abs(dx) > 6 || dy > 6) swMoved = true;
  const el = $('#pop'); el.style.transform = `translate(${dx}px, ${dy}px)`; el.style.opacity = String(Math.max(.2, 1 - (Math.abs(dx) + dy) / 220));
});
window.addEventListener('pointerup', e => {
  if (!sw) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, el = $('#pop'); sw = null; el.style.transition = '';
  if (Math.abs(dx) > 70 || dy > 45) { el.style.transform = `translate(${dx > 0 ? 400 : dx < 0 ? -400 : 0}px, ${dy > 45 ? 200 : 0}px)`; el.style.opacity = '0'; clearTimeout(popT); popT = setTimeout(() => { el.hidden = true; el.style.transform = ''; el.style.opacity = ''; }, 220); }
  else { el.style.transform = ''; el.style.opacity = ''; }
});
const busy = () => !$('#modal').hidden || !$('#dialList').hidden;

/* próxima misión: la de la agenda que viene, o la más cercana del mapa */
function nextUp() {
  const n = new Date(), mins = n.getHours() * 60 + n.getMinutes();
  const ag = S.tasks.filter(t => t.date === today() && t.st === 'open' && t.time).map(t => ({ t, dm: minsOf(t.time) - mins })).filter(x => x.dm >= -60 && x.dm <= 120).sort((a, b) => Math.abs(a.dm) - Math.abs(b.dm))[0];
  if (ag) return { kind: 'agenda', title: ag.t.title, sub: ag.dm > 5 ? `Agenda · en ${fmtMin(ag.dm)}` : ag.dm >= -5 ? 'Agenda · ¡es ahora!' : `Agenda · era hace ${fmtMin(-ag.dm)}` };
  if (pos) {
    const m = S.missions.filter(x => x.st === 'open').map(x => ({ x, d: dist(pos.ll, x.ll) })).sort((a, b) => a.d - b.d)[0];
    if (m) return { kind: 'map', id: m.x.id, title: m.x.txt, sub: `${m.x.name || D.TYPES[m.x.type].n} · a ${fmtD(m.d)}` };
  }
  return null;
}
let lastNext = 0;
function showNext(force) {
  if (!force && (tab !== 'mapa' || busy() || !$('#pop').hidden || Date.now() - lastNext < 40 * 60e3)) return;
  const n = nextUp(); if (!n) return;
  lastNext = Date.now();
  showPop(`<span class="pk">Próxima misión</span><b>${esc(n.title)}</b><small>${esc(n.sub)}</small>`, 7000, () => { hidePop(); if (n.kind === 'map') openMission(n.id); else setTab('misiones'); });
}
const nearSeen = {};
let lastNear = 0;
function nearCheck() { // te avisa cuando pasás cerca de una misión (como mucho cada media hora)
  if (!pos || busy() || !$('#pop').hidden || Date.now() - lastNear < 30 * 60e3) return;
  for (const m of S.missions) {
    if (m.st !== 'open' || nearSeen[m.id]) continue;
    const d = dist(pos.ll, m.ll);
    if (d < 150) { nearSeen[m.id] = 1; lastNear = Date.now(); showPop(`<span class="pk">Estás cerca</span><b>${esc(m.txt)}</b><small>${esc(m.name || D.TYPES[m.type].n)} · a ${fmtD(d)}</small>`, 8000, () => { hidePop(); openMission(m.id); }); return; }
  }
}

/* ---------- ¿qué estás haciendo? sesiones que suben atributos ---------- */
const ACTS = {
  entreno: ['Entrenando', 'F'], yoga: ['Yoga o elongación', 'F'], leer: ['Leyendo o estudiando', 'U'], proyecto: ['En un proyecto', 'U'],
  charla: ['Grabando o charlando', 'C'], casa: ['Ordenando la casa', 'R'], viaje: ['Viajando (tren o bondi)', 'R'], fe: ['Rezando o en misa', 'E'], laburo: ['Laburando', null], descanso: ['Descansando', null]
};
function askDoing(fromMenu) {
  if (S.walkOn || S.act) { if (fromMenu) toast('Ya tenés algo en curso: terminalo desde la barra de arriba'); return; }
  S.lastAsk = Date.now(); saveLocal();
  const chips = Object.entries(ACTS).map(([k, [n]]) => `<button type="button" class="tag tb" data-act="${k}">${n}</button>`).join('');
  if (fromMenu) {
    openM = null; hold = null; noteIdx = null;
    $('#modalBody').innerHTML = `<h2>¿Qué estás haciendo?</h2><p class="mute">Arrancá el cronómetro y al terminar suma a tu atributo (2 XP por minuto, hasta 120; viajando, 1 por minuto hasta 60). Si lo hacés con Vaca, el paseo va por su botón.</p><div class="tags">${chips}</div><button class="ghost" id="closeM">Cerrar</button>`;
    $('#modal').hidden = false;
  } else showPop(`<span class="pk">El juego te pregunta</span><b>¿Qué estás haciendo?</b><div class="tags">${chips}<button type="button" class="tag tb" data-act="no">Ahora no</button></div>`, 20000);
}
function maybeAsk() {
  const h = new Date().getHours();
  if (demo || S.walkOn || S.act || busy() || !$('#pop').hidden) return;
  if (h < 7 || h >= 23 || Date.now() - (S.lastAsk || 0) < 3 * 3600e3) return;
  askDoing(false);
}
function startAct(k) {
  hidePop(); closeModal();
  if (k === 'no') { S.lastAsk = Date.now(); saveLocal(); return; }
  const [n, a] = ACTS[k];
  if (!a) { S.lastAsk = Date.now(); saveLocal(); toast(k === 'laburo' ? 'Dale, te dejo tranquilo. ¡Buen laburo!' : 'Bien merecido. Disfrutalo'); return; }
  S.act = { k, start: Date.now() }; save(); keepAwake(false); actUI();
  toast(`${n}: arrancó el cronómetro`);
}
function actUI() {
  const bar = $('#actBar'), a = S.act; bar.hidden = !a;
  if (!a) return;
  const sec = Math.floor((Date.now() - a.start) / 1000);
  $('#actTxt').textContent = `${ACTS[a.k][0].replace(/ \(.*\)$/, '')} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function endAct(discard) {
  const a = S.act; if (!a) return;
  S.act = null; save(); actUI();
  const min = Math.min(240, Math.round((Date.now() - a.start) / 60000));
  if (discard || min < 5) { toast(discard ? 'Descartado' : 'Muy cortito: tiene que durar 5 minutos para contar'); return; }
  const viaje = a.k === 'viaje', [n, at] = ACTS[a.k], xp = (viaje ? Math.min(60, min) : Math.min(120, min * 2)) * xpMult();
  if (a.k === 'entreno' || a.k === 'yoga') S.body.tdays[today()] = 1;
  if (at === 'E') feCharge();
  const g = grant(xp, at, { type: 'act', act: a.k, txt: `${n} · ${fmtMin(min)}` });
  // si en la agenda de hoy había algo parecido, queda cumplido solo
  const kw = { entreno: /entren|pesas|rutina|patio/, yoga: /yoga|elong|estir/, leer: /leer|estudi/, proyecto: /proyect|program/, charla: /podcast|grab|charl/, casa: /orden|limpi/, fe: /misa|rez|igles/ }[a.k];
  const t = kw && S.tasks.find(x => x.date === today() && x.st === 'open' && kw.test(P.key(x.title)));
  if (t) completeTask(t.id, true);
  toast(g.up ? `¡Subiste a nivel ${g.up}!` : `${n}: +${xp} XP de ${D.ATTR[at]}`);
  if (a.k === 'entreno') setTimeout(() => showPop(`<span class="pk">Entrenamiento</span><b>¿Entrenaste a Vaca también?</b><div class="tags"><button type="button" class="tag tb" data-vt="1">Sí, anotar</button><button type="button" class="tag tb" data-vt="0">Hoy no</button></div>`, 15000), 1500);
  else offerNote(g.i);
}

/* ---------- Fe: se recarga en la iglesia ---------- */
const feNow = () => Math.max(0, Math.round(S.fe.v - (Date.now() - S.fe.t) / (3 * 3600e3)));
function feCharge() { S.fe.v = 100; S.fe.t = Date.now(); S.fe.visits = (S.fe.visits || 0) + 1; save(); hud(); }
function churchCheck(ll, acc) {
  if (!S.poi || (acc > 40 && !demo) || busy()) return;
  const t = today();
  for (const p of S.poi.list) {
    if (p.type !== 'iglesia' || S.fe.last[p.id] === t) continue;
    if (dist(ll, p.ll) <= 45) {
      S.fe.last[p.id] = t; saveLocal();
      showPop(`<span class="pk">Fe ${feNow()}%</span><b>Pasás por ${esc(p.name || 'una iglesia')}</b><small>¿Hacés la señal de la cruz?</small><div class="tags"><button type="button" class="tag tb" data-cruz="${esc(p.id)}">Hecho</button><button type="button" class="tag tb" data-cruz="">Ahora no</button></div>`, 25000);
      return;
    }
  }
}
function cruz(id) {
  hidePop(); if (!id) return;
  feCharge();
  const p = S.poi && S.poi.list.find(x => x.id === id);
  grant(10 * xpMult(), 'E', { type: 'fe', txt: 'Señal de la cruz' + (p && p.name ? ' en ' + p.name : '') });
  toast('La fe se recargó');
}

/* ---------- ficha del personaje y cuerpo ---------- */
// base de cada atributo según lo que contaste (se suma lo que vas ganando)
const ABASE = { F: 3, U: 7, C: 5, R: 5, E: 5 };
const atLv = k => ABASE[k] + Math.floor(Math.sqrt((S.at[k] || 0) / 40));
const MOODS = { 1: 'Muy mal', 2: 'Mal', 3: 'Normal', 4: 'Bien', 5: 'Excelente' };
const MCOL = { 1: '#e2392d', 2: '#ff9d1f', 3: '#aab5e8', 4: '#5fe0b0', 5: '#ffd23f' };
const nowLabel = () => { const n = new Date(); const d = n.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' }).replace(',', ''); return d.charAt(0).toUpperCase() + d.slice(1) + ' · ' + nowHM(); };
let lastClock = '';
function clockUI() { const t = nowLabel(); if (t !== lastClock) { lastClock = t; $('#clock').textContent = t; } }
const lastW = () => S.body.w.length ? S.body.w[S.body.w.length - 1] : null;
const imc = () => { const w = lastW(); return w ? w.kg / ((S.body.h / 100) ** 2) : null; };
function vFicha() {
  const w = lastW(), i = imc(), td = Object.keys(S.body.tdays).length, fe = feNow();
  const ws = S.body.w.slice(-8), mn = Math.min(...ws.map(x => x.kg)) - 1, mx = Math.max(...ws.map(x => x.kg)) + 1;
  return `<h3>Tu personaje</h3>
  <div class="ficha">${Object.keys(D.ATTR).map(k => `<div class="fat"><span>${D.ATTR[k]}</span><b style="color:${ACOLS[k]}">${atLv(k)}</b></div>`).join('')}</div>
  <p class="mute">Nivel de cada atributo: una base según lo que me contaste (arrancás con Fuerza 3, día 2 de entrenamiento) más lo que vas ganando.</p>
  <div class="row"><span>Fe</span><div class="bar" style="--c:var(--gold)"><i style="width:${fe}%"></i></div><span>${fe}% · ${S.fe.visits || 0} visita${S.fe.visits === 1 ? '' : 's'}</span></div>
  <h3>Cómo me siento hoy</h3>
  <div class="moods">${Object.entries(MOODS).map(([k, n]) => `<button type="button" class="mood" data-mood="${k}" aria-pressed="${S.mood[today()] === +k}" style="--m:${MCOL[k]}"><b>${k}</b><span>${n}</span></button>`).join('')}</div>
  <div class="mweek">${[...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const v = S.mood[dayKey(d)]; return `<div><i style="height:${v ? v * 8 : 3}px;background:${v ? MCOL[v] : 'rgba(255,255,255,.15)'}"></i><small>${d.toLocaleDateString('es-AR', { weekday: 'narrow' })}</small></div>`; }).join('')}</div>
  <h3>Cuerpo</h3>
  <div class="grid"><div class="st"><span>Altura</span><b>${(S.body.h / 100).toLocaleString('es-AR')} m</b></div><div class="st"><span>Peso</span><b>${w ? w.kg.toLocaleString('es-AR') + ' kg' : '—'}</b></div>
  <div class="st"><span>IMC</span><b>${i ? i.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : '—'}</b></div><div class="st"><span>Días entrenados</span><b>${td}</b></div></div>
  <p class="mute">El IMC solo mira peso y altura: no distingue músculo de grasa. Con tu plan de ganar músculo, el peso puede subir y estar todo bien; mirá también cómo te queda la ropa y cuánto levantás.</p>
  ${ws.length > 1 ? rows(ws.map(x => [fmtDay(x.d), x.kg - mn, x.kg.toLocaleString('es-AR') + ' kg']), mx - mn, 'var(--coral)') : ''}
  <div class="row2"><input id="kgIn" type="text" inputmode="decimal" placeholder="Peso de hoy (kg), ej. 83,6" aria-label="Peso de hoy en kg"><button class="ghost" id="kgSave">Anotar</button></div>`;
}

/* ---------- adiestrar a Vaca ---------- */
let vtSel = new Set(), vtR = 2;
function vacaTrain() {
  hidePop(); openM = null; hold = null; noteIdx = null; vtSel = new Set(); vtR = 2;
  const T = S.vtrain.tricks;
  $('#modalBody').innerHTML = `<div class="vaca-big">${vacaSprite()}</div><h2>Adiestramiento</h2>
    <p class="mute">¿Qué practicaron hoy?</p>
    <div class="tags" id="vtT">${T.map(t => `<button type="button" class="tag tb" data-vtt="${esc(t.id)}" aria-pressed="false">${esc(t.n)}</button>`).join('')}</div>
    <div class="row2" style="margin-top:6px"><input id="vtNew" placeholder="Truco nuevo (ej. quedarse quieta)" maxlength="40" aria-label="Truco nuevo"><button class="ghost" id="vtAdd">Sumar</button></div>
    <p class="mute" style="margin-top:12px">¿Cómo le fue?</p>
    <div class="tags">${[[1, 'Le costó'], [2, 'Bien'], [3, '¡La rompió!']].map(([n, l]) => `<button type="button" class="tag tb" data-vtr="${n}" aria-pressed="${n === 2}">${l}</button>`).join('')}</div>
    <button class="big" id="vtSave">Anotar sesión</button><button class="ghost" id="closeM">Cerrar</button>`;
  $('#modal').hidden = false;
}
function vtStats() {
  return S.vtrain.tricks.map(t => {
    const ss = S.vtrain.ses.filter(x => x.tricks.includes(t.id)), good = ss.filter(x => x.r >= 2).length;
    return [t.n, Math.min(5, Math.floor(good / 3)), ss.length];
  });
}

/* ---------- álbum del barrio ---------- */
const MEDAL = p => p >= 1 ? ['oro', 'Oro'] : p >= .5 ? ['plata', 'Plata'] : p >= .25 ? ['bronce', 'Bronce'] : null;
function vAlbum() {
  const list = S.poi ? S.poi.list : [], ids = new Set(list.map(p => p.id));
  const mine = list.filter(p => S.disc[p.id]), pct = list.length ? mine.length / list.length : 0, M = MEDAL(pct);
  const otros = Object.entries(S.disc).filter(([id]) => !ids.has(id));
  const sec = k => {
    const all = list.filter(p => p.type === k); if (!all.length) return '';
    const got = all.filter(p => S.disc[p.id]), m = MEDAL(got.length / all.length), miss = all.length - got.length;
    return `<h3>${D.TYPES[k].n}s <span class="mute" style="font:inherit;font-size:14px">${got.length}/${all.length}</span>${m ? ` <span class="medal-s ${m[0]}">${m[1]}</span>` : ''}</h3>
      <div class="stamps">${got.map(p => `<div class="stamp t-${k}"><i>${D.TYPES[k].g}</i><b>${esc(p.name || D.TYPES[k].n + ' sin nombre')}</b><small>${fmtDay(S.disc[p.id].d)}</small></div>`).join('')}${Array.from({ length: Math.min(miss, 8) }, () => '<div class="stamp empty"><i>?</i></div>').join('')}${miss > 8 ? `<div class="stamp empty"><small>+${miss - 8}</small></div>` : ''}</div>`;
  };
  return `<div class="alhd"><div><span class="mute">Álbum de</span><b class="alname">${esc(S.album)}</b></div><button class="ghost slim" id="alRen">Cambiar nombre</button></div>
    <div class="row"><span>Completo</span><div class="bar" style="--c:var(--gold)"><i style="width:${pct * 100}%"></i></div><span>${Math.round(pct * 100)}%${M ? ' · ' + M[1] : ''}</span></div>
    <p class="mute">${mine.length} de ${list.length} lugares. Cada lugar por el que pasás se pega solo. Medallas: bronce 25%, plata 50%, oro 100%.</p>
    ${Object.keys(D.TYPES).map(sec).join('')}
    ${otros.length ? `<h3>Otras zonas <span class="mute" style="font:inherit;font-size:14px">${otros.length}</span></h3><div class="stamps">${otros.map(([, v]) => `<div class="stamp t-${v.type}"><i>${D.TYPES[v.type] ? D.TYPES[v.type].g : '?'}</i><b>${esc(v.name || (D.TYPES[v.type] ? D.TYPES[v.type].n : 'Lugar'))}</b><small>${fmtDay(v.d)}</small></div>`).join('')}</div>` : ''}`;
}

/* ---------- resumen del domingo ---------- */
function weekStats(wk) {
  const ds = weekDays(wk), set = new Set(ds), L0 = S.log.filter(e => set.has(e.t));
  const xp = ds.reduce((s, d) => s + (S.xpDay[d] || 0), 0), km = ds.reduce((s, d) => s + (S.kmDay[d] || 0), 0);
  const at = {}; L0.forEach(e => { if (e.a) at[e.a] = (at[e.a] || 0) + e.xp; });
  const best = ds.map(d => [d, S.xpDay[d] || 0]).sort((a, b) => b[1] - a[1])[0];
  const notes = L0.filter(e => e.note).sort((a, b) => b.note.length - a.note.length);
  return { ds, xp, km, at, best, note: notes[0], mis: L0.filter(e => !['disc', 'find', 'fe', 'act'].includes(e.type)).length, disc: L0.filter(e => e.type === 'disc').length, finds: L0.filter(e => e.type === 'find').length,
    walks: S.walks.filter(w => set.has(w.d)).length, train: ds.filter(d => S.body.tdays[d]).length, fe: L0.filter(e => e.type === 'fe' || (e.type === 'iglesia')).length };
}
function vResumen() {
  const wk = weekKey(new Date()), w = weekStats(wk), prev = new Date(wk + 'T12:00'); prev.setDate(prev.getDate() - 7);
  const p = weekStats(dayKey(prev)), diff = p.xp ? Math.round((w.xp - p.xp) / p.xp * 100) : null;
  const topA = Object.entries(w.at).sort((a, b) => b[1] - a[1])[0];
  const du = S.duel && S.duel.week === wk ? S.duel : null;
  const mv = w.ds.map(d => S.mood[d]).filter(Boolean), mavg = mv.length ? mv.reduce((a, b) => a + b, 0) / mv.length : null;
  const cards = [['XP', w.xp], ['Km', fmtKm(w.km)], ['Ánimo promedio', mavg ? MOODS[Math.round(mavg)] : '—'], ['Misiones', w.mis], ['Lugares nuevos', w.disc], ['Hallazgos', w.finds], ['Paseos con Vaca', w.walks], ['Días entrenados', w.train], ['Fe', w.fe + ' momento' + (w.fe === 1 ? '' : 's')]];
  return `<p class="mute">Semana del ${fmtDay(w.ds[0])} al ${fmtDay(w.ds[6])}</p>
    <div class="grid">${cards.map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <h3>Lo destacado</h3><ul class="dl">
      ${diff != null ? `<li class="de"><b>${diff >= 0 ? `Sumaste ${diff}% más XP que la semana pasada` : `Sumaste ${-diff}% menos XP que la semana pasada`}</b></li>` : ''}
      ${w.best && w.best[1] ? `<li class="de"><b>Tu mejor día fue el ${new Date(w.best[0] + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long' })}</b><small>${w.best[1]} XP</small></li>` : ''}
      ${topA ? `<li class="de"><b>Lo que más creció: ${D.ATTR[topA[0]]}</b><small>+${topA[1]} XP</small></li>` : ''}
      ${w.note ? `<li class="de"><b>Momento de la semana</b><p class="dn">${esc(w.note.note)}</p><small>${esc(w.note.txt)}</small></li>` : ''}
      ${du ? `<li class="de"><b>Duelo: ${duelPts()} puntos${du.rival ? ` contra ${esc(du.rival.n)}` : ''}</b></li>` : ''}
    </ul>`;
}
function sundayCheck() {
  const n = new Date(), wk = weekKey(n);
  if (n.getDay() !== 0 || n.getHours() < 19 || S.sumShown === wk || busy() || !$('#pop').hidden) return;
  S.sumShown = wk; saveLocal();
  showPop(`<span class="pk">Domingo</span><b>Tu semana está lista</b><small>Tocá para ver el resumen</small>`, 15000, () => { hidePop(); setTab('resumen'); });
}

/* ---------- mapa de calor del mes ---------- */
const HC = 0.0006;
const monthKey = () => today().slice(0, 7);
function heatAdd(ll) { const m = monthKey(), k = Math.floor(ll[0] / HC) + ':' + Math.floor(ll[1] / HC); S.heat[m] = S.heat[m] || {}; S.heat[m][k] = (S.heat[m][k] || 0) + 1; }
const heatLayer = L.layerGroup();
let heatOn = false;
function heatToggle(on) {
  heatOn = on; heatLayer.clearLayers();
  if (!on) { if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer); hidePop(); return; }
  const H = S.heat[monthKey()] || {}, vals = Object.values(H), mx = Math.max(1, ...vals);
  for (const [k, v] of Object.entries(H)) {
    const [a, b] = k.split(':').map(Number), r = v / mx;
    L.rectangle([[a * HC, b * HC], [(a + 1) * HC, (b + 1) * HC]], { stroke: false, fillColor: r > .66 ? '#ff3b1f' : r > .33 ? '#ff9d1f' : '#ffd23f', fillOpacity: .25 + r * .45, interactive: false }).addTo(heatLayer);
  }
  heatLayer.addTo(map); setTab('mapa');
  showPop(`<span class="pk">Mapa de calor</span><b>${new Date().toLocaleDateString('es-AR', { month: 'long' })}: ${vals.length} cuadras caminadas</b><small>Tocá para ocultarlo</small>`, 0, () => heatToggle(false));
}

/* ---------- copia en la nube (Gist privado propio) ---------- */
const CLOUD_FILE = 'lifebgood-save.json';
let cloudT = null, cloudBusy = false, cloudPulled = false;
const cloudOn = () => !demo && !!fxToken();
function cloudSoon() { if (!cloudOn() || !cloudPulled) return; clearTimeout(cloudT); cloudT = setTimeout(() => cloudPush(false), 60000); }
function cloudPayload() { const c = JSON.parse(JSON.stringify(S)); c.poi = null; c.fx.token = ''; return JSON.stringify({ v: 1, app: 'Lifebgood', updatedAt: S.upd || 0, state: c }); }
async function cloudGist() {
  if (S.cloud.gist) return S.cloud.gist;
  for (let p = 1; p <= 3; p++) {
    const L0 = await ghApi(`/gists?per_page=100&page=${p}`);
    const g = L0.find(x => x.files && x.files[CLOUD_FILE]);
    if (g) { S.cloud.gist = g.id; saveLocal(); return g.id; }
    if (L0.length < 100) break;
  }
  const g = await ghApi('/gists', { method: 'POST', body: JSON.stringify({ description: 'Lifebgood: copia del progreso (no borrar)', public: false, files: { [CLOUD_FILE]: { content: cloudPayload() } } }) });
  S.cloud.gist = g.id; S.cloud.last = Date.now(); saveLocal(); return g.id;
}
const cloudErr = e => e.status === 401 ? 'El token no sirve o se venció' : e.status === 403 || e.status === 404 ? 'El token no tiene permiso de "gist"' : 'Sin conexión con GitHub';
async function cloudPush(inter) {
  if (!cloudOn() || cloudBusy) return; cloudBusy = true; clearTimeout(cloudT); cloudT = null;
  try {
    const id = await cloudGist();
    await ghApi('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: { [CLOUD_FILE]: { content: cloudPayload() } } }) });
    S.cloud.last = Date.now(); S.cloud.err = ''; saveLocal(); if (inter) toast('Progreso guardado en la nube');
  } catch (e) { S.cloud.err = cloudErr(e); saveLocal(); if (inter) toast(S.cloud.err); }
  cloudBusy = false; if (tab === 'stats') renderSheet();
}
async function cloudPull(inter) {
  if (!cloudOn() || cloudBusy) return; cloudBusy = true;
  try {
    const id = await cloudGist(), g = await ghApi('/gists/' + id), f = g.files[CLOUD_FILE];
    const r = f ? JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content) : null;
    cloudPulled = true;
    // primera vez en este aparato: gana la copia con más progreso (así un celu nuevo no pisa todo)
    const first = !S.cloud.synced, takeRemote = r && r.state && (first ? (r.state.xp || 0) > (S.xp || 0) : (r.updatedAt || 0) > (S.upd || 0));
    S.cloud.synced = true; saveLocal();
    if (takeRemote) {
      const keep = { token: S.fx.token, poi: S.poi, cloud: S.cloud, walkOn: S.walkOn, act: S.act };
      S = Object.assign(blank(), r.state); norm();
      S.fx.token = keep.token; S.poi = keep.poi; S.cloud = keep.cloud; S.cloud.synced = true; S.upd = r.updatedAt;
      if (keep.walkOn && !S.walkOn) S.walkOn = keep.walkOn; if (keep.act && !S.act) S.act = keep.act;
      S.cloud.last = Date.now(); S.cloud.err = ''; saveLocal();
      hud(); draw(); walkUI(); actUI(); renderSheet(); toast('Traje tu progreso de la nube');
    } else { cloudBusy = false; if (first || (S.upd || 0) > ((r && r.updatedAt) || 0)) await cloudPush(inter); else if (inter) toast('Ya estaba todo al día'); return; }
  } catch (e) { S.cloud.err = cloudErr(e); saveLocal(); if (inter) toast(S.cloud.err); }
  cloudBusy = false; if (tab === 'stats') renderSheet();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (cloudT) cloudPush(false); }
  else { if (cloudOn() && Date.now() - (S.cloud.last || 0) > 5 * 60e3) cloudPull(false); setTimeout(() => { maybeAsk(); sundayCheck(); }, 4000); }
});
function vCloud() {
  if (!fxToken()) return `<h3>Copia en la nube</h3><p class="mute">Se activa sola cuando conectás FUNVS (más abajo) con tu token de GitHub. Guarda todo tu progreso en un Gist privado y lo trae en cualquier aparato.</p>`;
  return `<h3>Copia en la nube</h3><p class="mute">${S.cloud.err ? '⚠ ' + esc(S.cloud.err) : S.cloud.last ? 'Última copia: ' + ago(S.cloud.last) + '. Se guarda sola un minuto después de cada cambio.' : 'Todavía no se guardó.'}</p>
    <div class="btns"><button class="ghost" id="clPush">Guardar ahora</button><button class="ghost" id="clPull">Traer de la nube</button></div>`;
}

/* ---------- modo 420 ---------- */
function set420(on) {
  if (on) document.documentElement.dataset.m420 = '1'; else delete document.documentElement.dataset.m420;
  try { localStorage.setItem('lifebgood-420', on ? '1' : ''); } catch (e) { /* nada */ }
  $('#m420').setAttribute('aria-pressed', on);
  toast(on ? 'Modo 420 activado' : 'Volviste a la normalidad');
}

/* ---------- HUD ---------- */
function hud() {
  const { L, lo, hi } = lvl(S.xp);
  fxLevels();
  $('#lv').textContent = L;
  $('#xpb').style.width = ((S.xp - lo) / (hi - lo) * 100) + '%';
  $('#xpt').textContent = `${S.xp} XP · faltan ${hi - S.xp} para nivel ${L + 1}`;
  const w = wxState();
  $('#kmHoy').textContent = fmtKm(S.kmDay[today()] || 0) + ' hoy' + (w ? ` · ${S.wx.temp}° ${WXN[w]}` : '');
  const vz = velezToday(); $('#vz').hidden = !vz; if (vz) $('#vz').textContent = `Hoy juega Vélez ${new Date(vz.date).toTimeString().slice(0, 5)} · XP x2`;
}

/* ---------- paneles ---------- */
let tab = 'mapa';
const TITLES = { misiones: 'Misiones', duelo: 'Duelo', diario: 'Diario', stats: 'Stats y logros', album: 'Álbum', resumen: 'Resumen de la semana' };
function setTab(t) {
  tab = t; dial(false);
  $('#sheet').hidden = t === 'mapa';
  $('#shTitle').textContent = TITLES[t] || '';
  document.querySelectorAll('.dial-it').forEach(b => b.classList.toggle('on', b.dataset.go === t));
  if (t !== 'mapa') $('#sheet').scrollTop = 0; else setTimeout(() => showNext(false), 600);
  renderSheet();
}
/* menú que se despliega (FAB expandible) */
function dial(open) {
  const o = open == null ? $('#dialList').hidden : open;
  $('#dialList').hidden = !o; $('#dialBg').hidden = !o;
  $('#dialMain').setAttribute('aria-expanded', o); $('#dialMain').classList.toggle('open', o);
  $('#dialWalkTxt').textContent = S.walkOn ? 'Paseo en curso' : 'Paseo con Vaca';
}
function renderSheet() {
  if (tab === 'mapa') return;
  const ae = document.activeElement;
  if (tab !== 'misiones' && ae && /INPUT|TEXTAREA/.test(ae.tagName) && $('#sheet').contains(ae)) return; // no borrar lo que estás escribiendo
  if (tab === 'misiones') {
    if (!$('#qaIn')) { $('#sheetBody').innerHTML = vMisShell(); qaOver = {}; }
    $('#agList').innerHTML = vAgenda(); $('#mapList').innerHTML = vMis(); $('#qaSug').innerHTML = vSug(); qaPreview();
    return;
  }
  if (tab === 'duelo') duelPay();
  $('#sheetBody').innerHTML = tab === 'stats' ? vStats() : tab === 'duelo' ? vDuelo() : tab === 'album' ? vAlbum() : tab === 'resumen' ? vResumen() : vDiario();
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

const count = k => S.log.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + 1, o), {});
const rows = (arr, mx, col) => arr.map(([l, v, r]) => `<div class="row"><span>${l}</span><div class="bar" style="--c:${col}"><i style="width:${mx ? v / mx * 100 : 0}%"></i></div><span>${r}</span></div>`).join('');

function vStats() {
  const { L } = lvl(S.xp);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d); return [d.toLocaleDateString('es-AR', { weekday: 'short' }), S.xpDay[k] || 0, S.kmDay[k] || 0]; });
  const mxd = Math.max(...days.map(d => d[1]));
  const ACOL = ACOLS;
  const mxa = Math.max(...Object.values(S.at));
  const bt = count('type'), br = count('rar');
  const mxt = Math.max(0, ...Object.values(bt));
  const si = streakInfo();
  const cards = [['Nivel', L], ['XP total', S.xp], ['Km caminados', fmtKm(S.km)], ['Misiones', S.log.filter(x => x.type !== 'disc' && x.type !== 'find').length], ['Hallazgos', S.log.filter(x => x.type === 'find').length], ['Lugares descubiertos', Object.keys(S.disc).length], ['Zonas pisadas', Object.keys(S.cells).length], ['Racha', si.n === 1 ? '1 día' : si.n + ' días'], ['Escudo de racha', si.shieldUsed ? 'Usado' : 'Disponible'], ['De tu agenda', S.log.filter(x => x.type === 'agenda').length], ['Vencidas', S.expired]];
  return `<h2>Estadísticas</h2>
  ${vFicha()}
  <div class="btns" style="margin-top:14px"><button class="ghost" id="goRes">Resumen de la semana</button><button class="ghost" id="heatBtn">${heatOn ? 'Ocultar mapa de calor' : 'Mapa de calor del mes'}</button></div>
  <h3>Números</h3>
  <div class="grid">${cards.map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
  <p class="mute" style="margin-top:8px">El escudo te cubre un día sin XP por semana para que no se corte la racha. Se recarga cada lunes.</p>
  ${vDisc()}
  ${vVaca()}
  ${S.vtrain.ses.length ? `<h3>Adiestramiento</h3>${vtStats().map(([n, st, c]) => `<div class="row"><span>${esc(n)}</span><div class="bar" style="--c:var(--gold)"><i style="width:${st / 5 * 100}%"></i></div><span>${'★'.repeat(st)}${'☆'.repeat(5 - st)} · ${c}</span></div>`).join('')}` : ''}
  <button class="ghost" id="vtOpen">Anotar adiestramiento de Vaca</button>
  <h3>Últimos 7 días</h3>${rows(days.map(([l, x, k]) => [l, x, x + ' XP · ' + fmtKm(k)]), mxd, 'var(--coral)')}
  <h3>Atributos</h3>${Object.keys(D.ATTR).map(k => `<div class="row"><span>${D.ATTR[k]}</span><div class="bar" style="--c:${ACOL[k]}"><i style="width:${mxa ? (S.at[k] || 0) / mxa * 100 : 0}%"></i></div><span>${S.at[k] || 0} XP</span></div>`).join('')}
  <h3>Por tipo de lugar</h3>${rows(Object.keys(D.TYPES).map(k => [D.TYPES[k].n, bt[k] || 0, (bt[k] || 0) + ' misiones']), mxt, 'var(--blue)')}
  <h3>Por rareza</h3><p class="mute">Comunes ${br.c || 0} · Raras ${br.r || 0} · Épicas ${br.e || 0}</p>
  ${vCloud()}
  ${vGcal()}
  ${vFunvs()}
  <h3>Skin</h3><div class="btns">${[['clasica', 'Clásica'], ['hacker', 'Hacker']].map(([k, n]) => `<button class="ghost skin" data-skin="${k}" aria-pressed="${(document.documentElement.dataset.skin || 'clasica') === k}">${n}</button>`).join('')}</div>
  <h3>Tus datos</h3><p class="mute">Todo queda guardado en este navegador. Hacé una copia de vez en cuando por si cambiás de celu.</p>
  <div class="btns"><button class="ghost" id="exp">Exportar copia</button><button class="ghost" id="imp">Importar copia</button></div>
  <button class="ghost" id="wipe">Borrar todo el progreso</button>
  ${vLogros()}`;
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
  ['Coleccionista', 'Descubrí 30 lugares distintos', () => [Object.keys(S.disc).length, 30]],
  ['Cartógrafo', 'Descubrí la mitad de los lugares de tu zona', () => [S.poi && S.poi.list.length ? Math.floor(S.poi.list.filter(p => S.disc[p.id]).length / S.poi.list.length * 100) : 0, 50]],
  ['Fortinero', 'Cumplí una misión en un día de Vélez', () => [S.log.filter(e => e.type !== 'disc' && (S.velez ? S.velez.ms : []).some(m => dayKey(new Date(m.date)) === e.t)).length ? 1 : 0, 1]],
  ['Duelista', 'Cumplí los 5 retos de un duelo', () => [S.duel ? duelRetos(S.duel.code).filter(duelDone).length : 0, 5]],
  ['Bitácora', 'Escribí 10 entradas en el diario', () => [S.log.filter(e => e.note).length, 10]],
  ['Mejor amiga', 'Registrá 10 paseos con Vaca', () => [S.walks.length, 10]],
  ['Buscador', 'Encontrá 50 cosas por la calle', () => [S.log.filter(e => e.type === 'find').length, 50]],
  ['Suertudo', 'Encontrá un sobre', () => [S.log.filter(e => e.type === 'find' && (e.ftype === 'vaca' || e.ftype === 'velez')).length, 1]],
  ['Maratón perruna', 'Caminá 10 km con Vaca (con GPS)', () => [Math.floor(S.walks.reduce((s, w) => s + (w.km || 0), 0)), 10]],
  ['Rutina perruna', 'Sacá a Vaca 7 días seguidos', () => { let n = 0; const d = new Date(); if (!S.walks.some(w => w.d === dayKey(d))) d.setDate(d.getDate() - 1); while (S.walks.some(w => w.d === dayKey(d))) { n++; d.setDate(d.getDate() - 1); } return [n, 7]; }],
  ['Puntual', 'Cumplí 10 misiones de tu agenda a horario', () => [S.log.filter(x => x.type === 'agenda' && !x.late).length, 10]],
  ['Lo dije y lo hice', 'Cumplí 5 misiones principales de tu agenda', () => [S.log.filter(x => x.type === 'agenda' && x.kind === 'p').length, 5]]
];
function vLogros() {
  const got = ACH.filter(a => { const [v, t] = a[2](); return v >= t; }).length;
  return `<h2 class="h2b">Logros</h2><p class="mute">${got} de ${ACH.length} desbloqueados</p><div class="achs">${ACH.map(([n, d, f]) => {
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
  if (e.target.id === 'dialBg') return dial(false);
  if (e.target.closest('#pop') && !e.target.closest('button')) { if (swMoved) { swMoved = false; return; } if (popAct) popAct(); else hidePop(); return; }
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tab) return setTab(b.dataset.tab);
  if (b.dataset.go) {
    const g = b.dataset.go; dial(false);
    if (g === 'walk') return S.walkOn ? toast('Ya hay un paseo en curso: terminalo desde la barra de arriba') : walkMenu();
    if (g === 'doing') return askDoing(true);
    if (g === 'nueva') { setTab('misiones'); setTimeout(() => { const i = $('#qaIn'); if (i) i.focus(); }, 50); return; }
    return setTab(tab === g ? 'mapa' : g);
  }
  if (b.dataset.open) return openMission(b.dataset.open);
  if (b.dataset.skin) return setSkin(b.dataset.skin);
  if (b.dataset.done) return completeTask(b.dataset.done);
  if (b.dataset.note) { $('#snack').hidden = true; return askNote(+b.dataset.note); }
  if (b.dataset.act) return startAct(b.dataset.act);
  if (b.dataset.cruz != null) return cruz(b.dataset.cruz);
  if (b.dataset.vt) { hidePop(); return b.dataset.vt === '1' ? vacaTrain() : null; }
  if (b.dataset.vtt) { const k = b.dataset.vtt; vtSel.has(k) ? vtSel.delete(k) : vtSel.add(k); b.setAttribute('aria-pressed', vtSel.has(k)); return; }
  if (b.dataset.vtr) { vtR = +b.dataset.vtr; document.querySelectorAll('[data-vtr]').forEach(x => x.setAttribute('aria-pressed', x === b)); return; }
  if (b.dataset.mood) { S.mood[today()] = +b.dataset.mood; save(); renderSheet(); toast('Anotado: hoy ' + MOODS[b.dataset.mood].toLowerCase()); return; }
  if (b.dataset.wmin) { document.querySelectorAll('[data-wmin]').forEach(x => x.setAttribute('aria-pressed', x === b)); return; }
  if (b.dataset.del) return removeTask(b.dataset.del);
  if (b.dataset.tkind) return cycleTask(b.dataset.tkind, 'kind');
  if (b.dataset.tattr) return cycleTask(b.dataset.tattr, 'a');
  if (b.dataset.cyc) { const p = P.parse($('#qaIn').value, new Date(), S.learn); if (b.dataset.cyc === 'kind') qaOver.kind = nextOf(CYC_K, qaOver.kind || p.kind); else qaOver.a = nextOf(CYC_A, qaOver.a || p.a); return qaPreview(); }
  if (b.dataset.sug) { const i = $('#qaIn'); i.value = b.dataset.sug + ' '; qaOver = {}; qaPreview(); i.focus(); return; }
  switch (b.id) {
    case 'here': {
      const m = S.missions.find(x => x.id === openM);
      if (!m) return;
      if (rainBlock(m)) { toast('Llueve: la plaza espera'); return; }
      if (!inRange(m)) { toast('Todavía estás lejos. Acercate y probá de nuevo.'); renderModal(); return; }
      hold = Date.now(); renderModal(); break;
    }
    case 'closeM': closeModal(); break;
    case 'dialMain': dial(); break;
    case 'shClose': setTab('mapa'); break;
    case 'walkMenu2': walkMenu(); break;
    case 'walkGo': startWalk(); break;
    case 'actEnd': endAct(false); break;
    case 'actX': if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; setTimeout(() => { b.textContent = 'Descartar'; delete b.dataset.sure; }, 3000); break; } endAct(true); break;
    case 'm420': set420(!document.documentElement.dataset.m420); break;
    case 'pop': if (popAct) popAct(); break;
    case 'clPush': cloudPush(true); break;
    case 'clPull': cloudPull(true); break;
    case 'goRes': setTab('resumen'); break;
    case 'heatBtn': heatToggle(!heatOn); break;
    case 'vtOpen': vacaTrain(); break;
    case 'vtAdd': { const v = ($('#vtNew').value || '').trim(); if (!v) break; const id = 't' + uid(); S.vtrain.tricks.push({ id, n: v.slice(0, 40) }); save(); vtSel.add(id); const c = document.createElement('button'); c.type = 'button'; c.className = 'tag tb'; c.dataset.vtt = id; c.setAttribute('aria-pressed', 'true'); c.textContent = v; $('#vtT').appendChild(c); $('#vtNew').value = ''; break; }
    case 'vtSave': {
      if (!vtSel.size) { toast('Elegí al menos un truco'); break; }
      S.vtrain.ses.push({ d: today(), t: Date.now(), tricks: [...vtSel], r: vtR });
      const names = S.vtrain.tricks.filter(t => vtSel.has(t.id)).map(t => t.n).join(', ');
      closeModal(); const g = grant(20 * xpMult(), 'C', { type: 'vtrain', txt: 'Adiestramiento de Vaca: ' + names });
      toast(g.up ? `¡Subiste a nivel ${g.up}!` : `Sesión anotada · +${20 * xpMult()} XP`); offerNote(g.i); break;
    }
    case 'kgSave': { const v = parseFloat(($('#kgIn').value || '').replace(',', '.')); if (!(v >= 30 && v <= 250)) { toast('Poné un peso válido en kg'); break; } const t = today(); S.body.w = S.body.w.filter(x => x.d !== t); S.body.w.push({ d: t, kg: Math.round(v * 10) / 10 }); save(); $('#kgIn').blur(); renderSheet(); toast('Peso anotado'); break; }
    case 'alRen': { const el = document.querySelector('.alname'); el.outerHTML = `<input id="alIn" class="alname-in" value="${esc(S.album)}" maxlength="30" aria-label="Nombre del álbum">`; b.id = 'alOk'; b.textContent = 'Listo'; $('#alIn').focus(); break; }
    case 'alOk': { const v = ($('#alIn').value || '').trim(); if (v) S.album = v; save(); $('#alIn').blur(); renderSheet(); break; }
    case 'fxSave': { const v = ($('#fxTok').value || '').trim(); if (!/^(ghp_|github_pat_|gho_)/.test(v)) { toast('Eso no parece un token de GitHub'); break; } S.fx.token = v; S.fx.gist = null; save(); renderSheet(); fxPush(true); cloudPulled = false; cloudPull(false).then(() => { cloudPulled = true; }); break; }
    case 'fxSend': fxPush(true); break;
    case 'fxForget': S.fx.token = ''; S.fx.gist = null; save(); renderSheet(); toast('Token quitado'); break;
    case 'walkEnd': finishWalk(false); break;
    case 'walkX':
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; setTimeout(() => { b.textContent = 'Descartar'; delete b.dataset.sure; }, 3000); break; }
      finishWalk(true); break;
    case 'walkManual': {
      const sel = document.querySelector('[data-wmin][aria-pressed=true]'), min = sel ? +sel.dataset.wmin : 30;
      const hm = ($('#wHora').value || nowHM()).split(':'), st = new Date(); st.setHours(+hm[0], +hm[1] || 0, 0, 0);
      if (st > new Date()) st.setDate(st.getDate() - 1);
      closeModal(); saveWalk({ start: st.getTime(), min, km: 0, src: 'manual' }); break;
    }
    case 'noteSave': {
      const e = S.log[noteIdx]; if (e) { const v = $('#note').value.trim(); if (v) e.note = v; else delete e.note; save(); }
      closeModal(); renderSheet(); if (e && e.note) toast('Guardado en el diario'); break;
    }
    case 'dNew':
      if (S.duel && S.duel.week >= weekKey(new Date()) && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tocá de nuevo: se pierde el duelo actual'; break; }
      newDuel(`LB-${weekKey(new Date()).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X')}`); break;
    case 'dJoin': newDuel(($('#dCode').value || '').trim().toUpperCase()); break;
    case 'dCopyCode': copyText(S.duel.code, 'Código copiado: mandáselo a tu rival'); break;
    case 'dCopyRes': duelPay(); copyText(myResult(), 'Resultado copiado: mandáselo por WhatsApp'); break;
    case 'dLoad':
      try {
        const v = ($('#dRival').value || '').trim(); if (!v.startsWith('LBR.')) throw new Error('fmt');
        const o = b64d(v.slice(4));
        if (o.c !== S.duel.code) { toast('Ese resultado es de otro duelo'); break; }
        S.duel.rival = { n: String(o.n || 'Rival').slice(0, 20), d: Array.isArray(o.d) ? o.d.map(String) : [], x: +o.x || 0, notes: o.notes && typeof o.notes === 'object' ? o.notes : {} };
        save(); $('#dRival').value = ''; $('#dRival').blur(); renderSheet(); toast('Resultados comparados');
      } catch (err) { toast('Ese no es un resultado de Lifebgood'); }
      break;
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
document.addEventListener('input', e => {
  if (e.target.id === 'qaIn') qaPreview();
  if (e.target.id === 'dName' && S.duel) { S.duel.name = e.target.value.trim().slice(0, 20); save(); }
  if (e.target.dataset.dnote && S.duel) { S.duel.notes[e.target.dataset.dnote] = e.target.value; save(); }
});
document.addEventListener('change', e => { if (e.target.dataset.dnote) { e.target.blur(); duelPay(); renderSheet(); } });
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('#pop').hidden) return hidePop(); if (openM || noteIdx != null) closeModal(); else if (!$('#dialList').hidden) dial(false); else if (tab !== 'mapa') setTab('mapa'); });

setInterval(() => { if (hold) tickHold(); }, 250);
setInterval(() => { if (S.walkOn) walkUI(); if (S.act) actUI(); clockUI(); }, 1000);
setInterval(() => { showNext(false); maybeAsk(); sundayCheck(); }, 20 * 60e3);
let lastSlot = Math.floor(Date.now() / SLOT);
setInterval(() => { dayCheck(); velezDay(); hud(); if (Math.floor(Date.now() / SLOT) !== lastSlot) { lastSlot = Math.floor(Date.now() / SLOT); draw(); } if (tab === 'misiones') renderSheet(); }, 60000);

/* ---------- arranque ---------- */
if (hacker()) document.querySelector('meta[name=theme-color]').content = '#020a04';
hud(); clockUI(); dayCheck(); velezDay(); draw(); walkUI(); actUI(); if (S.walkOn) keepAwake(true);
try { if (localStorage.getItem('lifebgood-420')) { document.documentElement.dataset.m420 = '1'; $('#m420').setAttribute('aria-pressed', 'true'); } } catch (e) { /* nada */ }
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
setTimeout(() => { if (cloudOn()) cloudPull(false); else cloudPulled = true; }, 1500);
setTimeout(() => { showNext(false); setTimeout(() => { maybeAsk(); sundayCheck(); }, 9000); }, 6000);
if (S.gcal.cid && gTok) syncCal(false);
if (location.hash === '#demo') startDemo();
else if (S.intro) startGPS();
else $('#intro').hidden = false;
})();
