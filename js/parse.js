// Entiende frases como "1 pasear a Vaca a las 16" y las convierte en misiones.
// 1 = principal, 2 = secundaria, 3 = diaria (se repite todos los días).
// Sin IA: reglas + lo que la app aprende de tus correcciones (learned).
(function (root) {
  'use strict';
  // pasa a minúsculas y saca tildes sin cambiar el largo del texto (para cortar por posición)
  const fold = s => [...s].map(c => c.normalize('NFD')[0]).join('').toLowerCase();
  const key = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const dayKey = d => d.toLocaleDateString('sv-SE');
  const WD = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const KW = {
    F: ['entren', 'pesas', 'gym', 'gimnasio', 'yoga', 'flexion', 'sentadill', 'correr', 'abdominal', 'rutina', 'estir', 'elong', 'fuerza', 'bici', 'patio'],
    R: ['pase', 'vaca', 'camin', 'limpi', 'orden', 'lavar', 'tramite', 'cocin', 'compra', 'super', 'barrer', 'oficina', 'laburo', 'trabajo', 'mandar', 'retirar', 'pagar'],
    C: ['juntada', 'junta', 'llamar', 'mensaje', 'podcast', 'cumple', 'visitar', 'charlar', 'reunion', 'salir', 'mama', 'papa', 'familia', 'amig', 'cita', 'grabar', 'hablar'],
    U: ['leer', 'estudi', 'aprend', 'curso', 'program', 'proyecto', 'investig', 'buscar', 'mirar', 'probar', 'escribir', 'idioma', 'ingles', 'portfolio', 'automatiz', 'lanzamiento']
  };
  const XP = { p: 80, s: 40, d: 20 };
  const KIND = { 1: 'p', 2: 's', 3: 'd' };

  function guessAttr(title) {
    const n = fold(title);
    for (const k of Object.keys(KW)) if (KW[k].some(w => n.includes(w))) return k;
    return 'U';
  }

  function parse(text, now, learned) {
    now = now || new Date();
    learned = learned || {};
    let s = ' ' + String(text || '').replace(/\s+/g, ' ').trim() + ' ';
    let kind = null;
    const mk = s.match(/^\s*([123])(?:[\s.)\-:]+)/);
    if (mk) { kind = KIND[mk[1]]; s = ' ' + s.slice(mk[0].length); }

    const date = new Date(now); date.setHours(0, 0, 0, 0);
    let h = null, mi = 0, pm = null;
    const cut = re => { const f = fold(s), m = re.exec(f); if (!m) return null; s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return m; };

    // momento del día ("de la tarde", "a la noche", "de la mañana")
    let m = cut(/\s(?:de|a|por)\s+la\s+(manana|tarde|noche)\b/);
    if (m) pm = m[1] !== 'manana';
    // día
    if (cut(/\spasado\s+manana\b/)) date.setDate(date.getDate() + 2);
    else if (cut(/\smanana\b/)) date.setDate(date.getDate() + 1);
    else if (cut(/\shoy\b/)) { /* hoy */ }
    else if ((m = cut(/\s(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/))) {
      const target = WD.indexOf(m[1]); let add = (target - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + add);
    } else if ((m = cut(/\s(?:el\s+)?(\d{1,2})\/(\d{1,2})\b/))) {
      const d2 = new Date(date.getFullYear(), +m[2] - 1, +m[1]);
      if (d2 < date) d2.setFullYear(d2.getFullYear() + 1);
      date.setTime(d2.getTime());
    }
    // hora: "a las 16", "16:30", "16.30", "16hs", "a la 1"
    if ((m = cut(/\s(?:a\s+las?\s+)?(\d{1,2})[:.](\d{2})\s*(?:hs?|horas)?(?=\s)/))) { h = +m[1]; mi = +m[2]; }
    else if ((m = cut(/\sa\s+las?\s+(\d{1,2})\s*(?:hs?|horas)?(?=\s)/))) h = +m[1];
    else if ((m = cut(/\s(\d{1,2})\s*(?:hs|h|horas)(?=\s)/))) h = +m[1];
    if (h != null && pm === true && h < 12) h += 12;
    const time = h != null && h < 24 && mi < 60 ? String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') : null;

    let title = s.replace(/\s+/g, ' ').trim().replace(/^(?:a\s+las?|a|el|la)\s+/i, '').replace(/\s+(?:a\s+las?|a|el)$/i, '').trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    const L = learned[key(title)];
    const a = L ? L.a : guessAttr(title);
    if (!kind) kind = L ? L.kind : 's';
    return { title, kind, a, date: dayKey(date), time, xp: XP[kind], known: !!L };
  }

  const api = { parse, key, guessAttr, XP };
  if (typeof module !== 'undefined') module.exports = api; else root.LB_PARSE = api;
})(this);
