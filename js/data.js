// Datos del juego: tipos de lugar (OpenStreetMap), misiones posibles, rarezas y atributos.
window.LB_DATA = {
  TYPES: {
    kiosco: { n: 'Kiosco', g: 'K', r: 30, t: [
      ['Entrá y comprá algo que nunca probaste', 'U'],
      ['Preguntale al kiosquero qué es lo que más se vende', 'C'],
      ['Comprá un alfajor y ponele nota del 1 al 10', 'U'],
      ['Preguntale el nombre al que atiende y saludalo por su nombre', 'C']
    ]},
    panaderia: { n: 'Panadería', g: 'Pa', r: 30, t: [
      ['Comprá una factura que nunca elegiste', 'U'],
      ['Preguntá cuál es la especialidad de la casa', 'C']
    ]},
    plaza: { n: 'Plaza', g: 'Pz', r: 70, t: [
      ['Sentate 5 minutos a mirar el cielo, sin celu', 'R'],
      ['Hacé 20 sentadillas', 'F'],
      ['Dale una vuelta completa caminando', 'R'],
      ['Hacé 10 flexiones apoyado en un banco', 'F']
    ]},
    heladeria: { n: 'Heladería', g: 'H', r: 30, t: [
      ['Probá un gusto que nunca pediste', 'U'],
      ['Pedí que te recomienden un gusto', 'C']
    ]},
    verduleria: { n: 'Verdulería', g: 'V', r: 30, t: [
      ['Comprá una fruta de estación', 'R'],
      ['Preguntá qué está más rico esta semana', 'C']
    ]},
    iglesia: { n: 'Iglesia', g: '†', r: 40, t: [
      ['Entrá un momento y hacé la señal de la cruz', 'E'],
      ['Quedate un minuto en silencio y agradecé algo de hoy', 'E'],
      ['Rezá por alguien que quieras', 'E']
    ]},
    cafe: { n: 'Café', g: 'C', r: 30, t: [
      ['Pedí un café y quedate 10 minutos sin el celu', 'R'],
      ['Pedí algo de la carta que no conocés', 'U']
    ]}
  },
  RAR: { c: { n: 'Común', xp: 30 }, r: { n: 'Rara', xp: 60 }, e: { n: 'Épica', xp: 120 } },
  ATTR: { F: 'Fuerza', U: 'Curiosidad', C: 'Carisma', R: 'Resistencia', E: 'Fe' }
};
