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
    ]},
    supermercado: { n: 'Supermercado', g: 'S', r: 45, t: [
      ['Comprá algo de tu lista de compras', 'R'],
      ['Encontrá el producto más barato de una góndola', 'U'],
      ['Preguntale algo a un repositor', 'C']
    ]},
    gimnasio: { n: 'Gimnasio al aire libre', pl: 'Gimnasios al aire libre', g: 'G', r: 40, t: [
      ['Hacé 3 series en una máquina', 'F'],
      ['Colgate de una barra 20 segundos', 'F'],
      ['Probá una máquina que nunca usaste', 'F']
    ]},
    biblioteca: { n: 'Biblioteca', g: 'B', r: 35, t: [
      ['Entrá y hojeá un libro al azar', 'U'],
      ['Preguntá cómo hacerte socio', 'C']
    ]},
    mural: { n: 'Mural', pl: 'Murales', g: 'Mu', r: 30, t: [
      ['Miralo un minuto y elegí tu detalle favorito', 'U'],
      ['Sacale una foto y averiguá quién lo pintó', 'U']
    ]},
    monumento: { n: 'Monumento', g: 'Mo', r: 35, t: [
      ['Leé la placa y aprendé qué recuerda', 'U'],
      ['Contale a alguien lo que aprendiste ahí', 'C']
    ]},
    estacion: { n: 'Estación de tren', pl: 'Estaciones de tren', g: 'Tr', r: 80, t: [
      ['Caminá el andén de punta a punta', 'R'],
      ['Mirá pasar un tren sin sacar el celu', 'R']
    ]},
    cancha: { n: 'Cancha', g: 'F', r: 60, t: [
      ['Mirá 10 minutos de un picado', 'C'],
      ['Corré 3 veces el largo de la cancha', 'R']
    ]},
    canil: { n: 'Canil', pl: 'Caniles', g: 'Ca', r: 50, t: [
      ['Llevá a Vaca a jugar 10 minutos', 'C'],
      ['Que Vaca se haga un amigo nuevo', 'C']
    ]}
  },
  RAR: { c: { n: 'Común', xp: 30 }, r: { n: 'Rara', xp: 60 }, e: { n: 'Épica', xp: 120 } },
  ATTR: { F: 'Fuerza', U: 'Curiosidad', C: 'Carisma', R: 'Resistencia', E: 'Fe' }
};
