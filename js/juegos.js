// Juegos del barrio: se destraban al llegar a una plaza o cancha (penales), un súper (la caja) o una iglesia (el vitral).
// LB_GAMES.play(tipo, { practice, onEnd }) abre el juego; onEnd(resultado) devuelve el texto del premio.
(() => {
'use strict';
const $ = s => document.querySelector(s);
const INFO = {
  penales: { n: 'Penales', d: '5 tiros contra el arquero. Deslizá el dedo desde la pelota hacia el arco: el largo del gesto decide la altura.' },
  caja: { n: 'La caja del súper', d: 'Pasá los productos por el lector justo cuando cruzan la línea roja. Ojo con el separador del siguiente cliente: ese no se cobra.' },
  vitral: { n: 'El vitral', d: 'Encontrá los pares de símbolos para armar el vitral. Cuantos menos intentos, mejor.' }
};

const wrap = document.createElement('div');
wrap.className = 'game'; wrap.id = 'game'; wrap.hidden = true;
wrap.innerHTML = '<div class="ghd"><b id="gTitle"></b><button id="gClose" aria-label="Salir del juego"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button></div><div class="gbody" id="gBody"></div>';
document.body.appendChild(wrap);

let cur = null; // { kind, opts, stop }
let actx = null;
function beep(f, ms, type) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = f; g.gain.value = .06;
    o.connect(g); g.connect(actx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + ms / 1000); o.stop(actx.currentTime + ms / 1000 + .02);
  } catch (e) { /* sin sonido */ }
}
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* nada */ } };
function canvasFit(cv, W, H) {
  const r = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * r; cv.height = H * r;
  const x = cv.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return x;
}
const ptr = (cv, e, W) => { const b = cv.getBoundingClientRect(), k = W / b.width; return { x: (e.clientX - b.left) * k, y: (e.clientY - b.top) * k }; };
const hk = () => document.documentElement.dataset.skin === 'hacker';

function play(kind, opts) {
  if (cur) close();
  cur = { kind, opts: opts || {}, stop: null };
  $('#gTitle').textContent = INFO[kind].n + (cur.opts.practice ? ' · práctica' : '');
  wrap.hidden = false;
  intro();
}
function intro() {
  const { kind, opts } = cur;
  $('#gBody').innerHTML = `<div class="gint"><div class="gico gi-${kind}">${kind === 'penales' ? '⚽' : kind === 'caja' ? '🛒' : '✝'}</div>
    <p>${INFO[kind].d}</p>${opts.place ? `<p class="mute">${opts.place}</p>` : ''}${opts.practice ? '<p class="mute">Modo práctica: no da premio, sirve para entrenar.</p>' : ''}
    <button class="big" id="gGo">Jugar</button></div>`;
  $('#gGo').onclick = () => { beep(660, 80); (kind === 'penales' ? penales : kind === 'caja' ? caja : vitral)($('#gBody'), finish); };
}
function finish(res) {
  if (!cur) return;
  cur.stop = null;
  const { opts } = cur;
  const prize = opts.onEnd ? opts.onEnd(res) : '';
  const stars = '★'.repeat(res.tier) + '☆'.repeat(3 - res.tier);
  $('#gBody').innerHTML = `<div class="gint"><div class="gstars" aria-label="${res.tier} de 3 estrellas">${stars}</div>
    <h2>${res.title}</h2><p>${res.txt}</p>${prize ? `<p class="gprize">${prize}</p>` : ''}
    ${opts.practice ? '<button class="big" id="gAgain">Jugar de nuevo</button>' : ''}<button class="ghost" id="gBack">Volver</button></div>`;
  beep(res.tier >= 2 ? 880 : 440, 200, 'triangle');
  if (opts.practice) $('#gAgain').onclick = () => intro();
  $('#gBack').onclick = close;
}
function close() {
  if (cur && cur.stop) cur.stop();
  cur = null; wrap.hidden = true; $('#gBody').innerHTML = '';
}
$('#gClose').onclick = close;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur) { e.stopImmediatePropagation(); close(); } }, true);

/* ---------- penales ---------- */
function penales(body, end) {
  const W = 360, H = 460, GL = 70, GR = 290, GT = 92, GB = 196, CX = 180, B0 = { x: 180, y: 392 };
  body.innerHTML = `<div class="gtop"><span id="pgS">Tiro 1 de 5</span><span id="pgDots"></span></div><canvas class="gcv" id="pgC" style="aspect-ratio:${W}/${H}"></canvas><p class="gh">Deslizá desde la pelota hacia el arco</p>`;
  const cv = body.querySelector('#pgC'), x = canvasFit(cv, W, H);
  let shot = 0, goals = 0, res = [], st = 'aim', drag = null, A = null, msg = '', raf = 0, alive = true;
  const kp = { x: CX, tx: CX, tilt: 0 }, ball = { x: B0.x, y: B0.y, r: 13 };
  cur.stop = () => { alive = false; cancelAnimationFrame(raf); };
  const dots = () => { body.querySelector('#pgDots').innerHTML = [0, 1, 2, 3, 4].map(i => `<i class="pd2 ${res[i] || ''}"></i>`).join(''); body.querySelector('#pgS').textContent = shot < 5 ? `Tiro ${shot + 1} de 5` : 'Final'; };
  dots();
  function scene() {
    const H2 = hk();
    for (let i = 0; i < 10; i++) { x.fillStyle = H2 ? (i % 2 ? '#03140a' : '#052010') : (i % 2 ? '#2f9a4a' : '#36a853'); x.fillRect(0, i * 46, W, 46); }
    x.strokeStyle = H2 ? '#00ff66' : 'rgba(255,255,255,.85)'; x.lineWidth = 3;
    x.strokeRect(30, GB, W - 60, 120); x.strokeRect(110, GB, W - 220, 46);
    x.beginPath(); x.arc(CX, 340, 3, 0, 7); x.fillStyle = x.strokeStyle; x.fill();
    x.lineWidth = 1; x.strokeStyle = H2 ? 'rgba(0,255,102,.35)' : 'rgba(255,255,255,.35)';
    for (let i = GL; i <= GR; i += 14) { x.beginPath(); x.moveTo(i, GT); x.lineTo(i + (i - CX) * .08, GB - 6); x.stroke(); }
    for (let j = GT; j <= GB; j += 12) { x.beginPath(); x.moveTo(GL, j); x.lineTo(GR, j); x.stroke(); }
    x.lineWidth = 7; x.strokeStyle = H2 ? '#00ff66' : '#fff'; x.beginPath(); x.moveTo(GL, GB); x.lineTo(GL, GT); x.lineTo(GR, GT); x.lineTo(GR, GB); x.stroke();
    // arquero
    x.save(); x.translate(kp.x, GB - 2); x.rotate(kp.tilt);
    x.fillStyle = H2 ? '#00e5ff' : '#ffd23f'; x.fillRect(-14, -48, 28, 30);
    x.fillStyle = H2 ? '#0e2a17' : '#17225a'; x.fillRect(-12, -18, 10, 18); x.fillRect(2, -18, 10, 18);
    x.fillStyle = '#e2a877'; x.fillRect(-8, -64, 16, 16);
    x.fillStyle = H2 ? '#00e5ff' : '#ffd23f'; x.fillRect(-26, -50, 12, 8); x.fillRect(14, -50, 12, 8);
    x.fillStyle = '#fff'; x.fillRect(-30, -52, 6, 10); x.fillRect(24, -52, 6, 10);
    x.restore();
    // pelota
    x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#111'; x.stroke();
    x.beginPath(); x.arc(ball.x, ball.y, ball.r * .38, 0, 7); x.fillStyle = '#111'; x.fill();
    if (drag && drag.c) { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 4; x.setLineDash([6, 8]); x.beginPath(); x.moveTo(B0.x, B0.y); x.lineTo(drag.c.x, drag.c.y); x.stroke(); x.setLineDash([]); }
    if (msg) { x.font = "700 34px 'Pixelify Sans', monospace"; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = '#000'; x.strokeText(msg, CX, 290); x.fillStyle = msg.startsWith('GO') ? '#ffd23f' : '#fff'; x.fillText(msg, CX, 290); }
  }
  function loop(t) {
    if (!alive) return;
    if (A) {
      const p = Math.min(1, (t - A.t0) / A.ms), e = 1 - (1 - p) ** 2;
      ball.x = B0.x + (A.tx - B0.x) * e; ball.y = B0.y + (A.ty - B0.y) * e - Math.sin(p * Math.PI) * A.arc; ball.r = 13 - 5 * e;
      const kpP = Math.min(1, (t - A.t0) / (A.ms * .8)); kp.x = CX + (kp.tx - CX) * kpP; kp.tilt = (kp.tx - CX) / 85 * 1.1 * kpP;
      if (p >= 1 && !A.done) { A.done = true; msg = A.out; A.t1 = t; if (A.goal) { beep(988, 120); setTimeout(() => beep(1318, 260), 120); buzz([40, 30, 80]); } else beep(196, 260, 'sawtooth'); }
      if (A.done && t - A.t1 > 1100) next();
    }
    scene(); raf = requestAnimationFrame(loop);
  }
  function next() {
    A = null; msg = ''; shot++; dots();
    if (shot >= 5) { alive = false; cancelAnimationFrame(raf); const tier = goals >= 5 ? 3 : goals >= 3 ? 2 : goals >= 1 ? 1 : 0; return end({ score: goals, max: 5, tier, title: goals === 5 ? '¡Perfecto!' : goals >= 3 ? 'Ganaste la serie' : 'Te atajaron casi todo', txt: `Hiciste ${goals} de 5 goles.` }); }
    ball.x = B0.x; ball.y = B0.y; ball.r = 13; kp.x = kp.tx = CX; kp.tilt = 0; st = 'aim';
  }
  function shoot(dx, dy) {
    const up = -dy; if (up < 30) return;
    const len = Math.min(280, Math.hypot(dx, dy));
    const tx = B0.x + dx / up * (B0.y - (GT + GB) / 2);
    const ty = GB - 14 - (Math.max(40, len) - 40) / 200 * (GB - GT + 34);
    // el arquero elige un lado; desde el 3er tiro a veces te lee la intención
    let zone = [-1, 0, 1][Math.floor(Math.random() * 3)];
    if (shot >= 2 && Math.random() < .3) zone = tx < CX - 40 ? -1 : tx > CX + 40 ? 1 : 0;
    kp.tx = CX + zone * 82;
    const reach = zone === 0 ? 40 : 46, angle = ty < GT + 30 && Math.abs(tx - CX) > 78;
    let out, goal = false;
    if (ty < GT - 4) out = '¡Por arriba!';
    else if (tx < GL - 4 || tx > GR + 4) out = 'Afuera';
    else if (tx < GL + 5 || tx > GR - 5 || (ty < GT + 5 && ty >= GT - 4)) out = '¡Palo!';
    else if (Math.abs(tx - kp.tx) < reach && !angle) out = '¡Atajó!';
    else { out = 'GOOOL'; goal = true; goals++; }
    res[shot] = goal ? 'g' : 'x';
    st = 'fly'; A = { t0: performance.now(), ms: 620, tx, ty, arc: 26, out, goal };
    beep(330, 60);
  }
  cv.addEventListener('pointerdown', e => { if (st !== 'aim') return; const p = ptr(cv, e, W); if (Math.hypot(p.x - B0.x, p.y - B0.y) > 90 && p.y < 300) return; drag = { s: p, c: p }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (drag) drag.c = ptr(cv, e, W); });
  cv.addEventListener('pointerup', e => { if (!drag) return; const p = ptr(cv, e, W), d = drag; drag = null; shoot(p.x - d.s.x, p.y - d.s.y); });
  cv.addEventListener('pointercancel', () => { drag = null; });
  raf = requestAnimationFrame(loop);
}

/* ---------- la caja del súper ---------- */
const PROD = [['🍞', 'Pan', 2500], ['🥛', 'Leche', 1800], ['🧀', 'Queso', 6900], ['🍎', 'Manzanas', 2900], ['🥫', 'Tomate', 1200], ['🍫', 'Chocolate', 2100], ['🧃', 'Jugo', 1500], ['🥚', 'Huevos', 4300], ['🍝', 'Fideos', 1600], ['🧻', 'Papel', 3800], ['🍌', 'Bananas', 2400], ['🧉', 'Yerba', 4200]];
function caja(body, end) {
  const W = 360, H = 300, LX = 180, ZONE = 30, DUR = 40;
  body.innerHTML = `<div class="gtop"><span id="cjT">${DUR} s</span><span id="cjS">0 pasados · 0 errores</span></div><canvas class="gcv" id="cjC" style="aspect-ratio:${W}/${H}"></canvas>
    <div class="cjtk" id="cjTk" aria-live="polite">Ticket vacío</div><button class="big" id="cjB">Pasar por el lector</button>`;
  const cv = body.querySelector('#cjC'), x = canvasFit(cv, W, H);
  let items = [], t0 = performance.now(), lastT = t0, nextAt = 0, ok = 0, err = 0, miss = 0, total = 0, flash = 0, flashC = '', alive = true, raf = 0, belt = 0;
  const tk = [];
  cur.stop = () => { alive = false; cancelAnimationFrame(raf); };
  const speed = el => 95 + el * 3.2;
  function spawn(el) {
    const sep = items.length && Math.random() < .14 && !items[items.length - 1].sep;
    items.push(sep ? { x: W + 40, sep: true } : { x: W + 30, p: PROD[Math.floor(Math.random() * PROD.length)] });
    nextAt = el + (0.55 + Math.random() * .7) * (120 / speed(el));
  }
  function scan() {
    if (!alive) return;
    const it = items.find(i => !i.done && Math.abs(i.x - LX) <= ZONE + (i.sep ? 18 : 0));
    if (!it) { err++; flash = 1; flashC = '#ff6a5c'; beep(150, 160, 'sawtooth'); buzz(60); return hudC(); }
    it.done = true;
    if (it.sep) { err++; flash = 1; flashC = '#ff6a5c'; beep(150, 200, 'sawtooth'); buzz([60, 40, 60]); it.bad = true; return hudC('¡Ese es el separador!'); }
    ok++; total += it.p[2]; tk.unshift(`${it.p[0]} ${it.p[1]} $${it.p[2].toLocaleString('es-AR')}`); flash = 1; flashC = '#5fe0b0'; beep(1568, 70);
    hudC();
  }
  function hudC(note) {
    body.querySelector('#cjS').textContent = `${ok} pasados · ${err + miss} errores`;
    body.querySelector('#cjTk').textContent = note || (tk.length ? tk.slice(0, 3).join('   ') + `   · Total $${total.toLocaleString('es-AR')}` : 'Ticket vacío');
  }
  function loop(t) {
    if (!alive) return;
    const el = (t - t0) / 1000, dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
    const left = Math.max(0, DUR - el);
    body.querySelector('#cjT').textContent = Math.ceil(left) + ' s';
    if (left <= 0) {
      alive = false; cancelAnimationFrame(raf);
      const score = Math.max(0, ok - err - miss), tier = score >= 24 ? 3 : score >= 15 ? 2 : score >= 6 ? 1 : 0;
      return end({ score, max: 30, tier, title: tier === 3 ? 'Cajero del mes' : tier === 2 ? 'Buen turno' : tier === 1 ? 'Primer día en la caja' : 'Se armó cola', txt: `${ok} productos cobrados, ${err} errores y ${miss} que se te pasaron. Ticket: $${total.toLocaleString('es-AR')}.` });
    }
    if (el >= nextAt) spawn(el);
    const v = speed(el); belt = (belt + v * dt) % 24;
    for (const i of items) { i.x -= v * dt; if (!i.done && !i.sep && i.x < LX - ZONE - 4) { i.done = true; i.missed = true; miss++; beep(220, 120, 'sawtooth'); hudC(); } }
    items = items.filter(i => i.x > -40);
    const H2 = hk();
    x.fillStyle = H2 ? '#020a04' : '#22307a'; x.fillRect(0, 0, W, H);
    x.fillStyle = H2 ? '#0e2a17' : '#3a3f55'; x.fillRect(0, 160, W, 80);
    x.fillStyle = H2 ? '#163a22' : '#2a2e40'; for (let k = -24; k < W + 24; k += 24) x.fillRect(k + 24 - belt, 160, 3, 80);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(LX - ZONE, 150, ZONE * 2, 100);
    x.strokeStyle = '#ff2b2b'; x.lineWidth = 3; x.beginPath(); x.moveTo(LX, 146); x.lineTo(LX, 254); x.stroke();
    x.fillStyle = H2 ? '#00ff66' : '#fff'; x.font = "700 14px 'Pixelify Sans', monospace"; x.textAlign = 'center'; x.fillText('LECTOR', LX, 138);
    if (flash > 0) { x.fillStyle = flashC; x.globalAlpha = flash * .35; x.fillRect(0, 0, W, H); x.globalAlpha = 1; flash = Math.max(0, flash - dt * 3); }
    for (const i of items) {
      if (i.sep) { x.fillStyle = i.bad ? '#ff6a5c' : '#ffd23f'; x.fillRect(i.x - 34, 186, 68, 26); x.fillStyle = '#111'; x.font = "700 11px 'Pixelify Sans', monospace"; x.fillText('SIGUIENTE', i.x, 203); continue; }
      x.globalAlpha = i.done ? .35 : 1; x.font = '40px serif'; x.textAlign = 'center'; x.fillText(i.p[0], i.x, 214); x.globalAlpha = 1;
      if (i.done && !i.missed) { x.fillStyle = '#5fe0b0'; x.font = "700 18px 'Pixelify Sans', monospace"; x.fillText('✓', i.x, 172); }
    }
    raf = requestAnimationFrame(loop);
  }
  body.querySelector('#cjB').addEventListener('pointerdown', e => { e.preventDefault(); scan(); });
  cv.addEventListener('pointerdown', e => { e.preventDefault(); scan(); });
  const key = e => { if (cur && cur.kind === 'caja' && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); scan(); } };
  document.addEventListener('keydown', key);
  const st0 = cur.stop; cur.stop = () => { st0(); document.removeEventListener('keydown', key); };
  spawn(0); raf = requestAnimationFrame(loop);
}

/* ---------- el vitral ---------- */
function vitral(body, end) {
  const SYM = ['✝', '🕊', '🐟', '🕯', '⭐', '📖', '🔔', '🍇'];
  const COL = ['#2f55e0', '#e2392d', '#ffd23f', '#1f9e75', '#8a4fd8', '#ff9d1f', '#4fd3ea', '#d4537e'];
  const deck = [...SYM.keys(), ...SYM.keys()];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  body.innerHTML = `<div class="gtop"><span id="vtM">0 intentos</span><span id="vtP">0 de 8 pares</span></div>
    <div class="vit" id="vit">${deck.map((k, i) => `<button class="vc" data-i="${i}" aria-label="Vidrio ${i + 1}"><span>${SYM[k]}</span></button>`).join('')}</div><p class="gh">Tocá dos vidrios para darlos vuelta</p>`;
  let open = [], moves = 0, pairs = 0, lock = false, alive = true;
  cur.stop = () => { alive = false; };
  body.querySelector('#vit').addEventListener('click', e => {
    const b = e.target.closest('.vc'); if (!b || lock || !alive || b.classList.contains('up')) return;
    const k = deck[+b.dataset.i]; b.classList.add('up'); b.style.setProperty('--vc', COL[k]); open.push(b); beep(520 + k * 60, 90, 'triangle');
    if (open.length < 2) return;
    moves++; body.querySelector('#vtM').textContent = moves + (moves === 1 ? ' intento' : ' intentos');
    const [a, c] = open; open = [];
    if (deck[+a.dataset.i] === deck[+c.dataset.i]) {
      a.classList.add('ok'); c.classList.add('ok'); pairs++; body.querySelector('#vtP').textContent = `${pairs} de 8 pares`; setTimeout(() => beep(1046, 160, 'triangle'), 90);
      if (pairs === 8) { alive = false; setTimeout(() => { const tier = moves <= 12 ? 3 : moves <= 17 ? 2 : 1; end({ score: moves, max: 8, tier, title: 'Vitral completo', txt: `Lo armaste en ${moves} intentos (lo perfecto son 8). La luz ya entra por los vidrios.` }); }, 700); }
    } else { lock = true; setTimeout(() => { a.classList.remove('up'); c.classList.remove('up'); lock = false; }, 750); }
  });
}

window.LB_GAMES = { INFO, play, close, open: () => !!cur };
})();
