# Lifebgood

Misiones en la vida real sobre el mapa de tu barrio. Cada día aparecen misiones en kioscos, plazas, panaderías, heladerías, verdulerías y cafés reales (datos de OpenStreetMap). Para cumplirlas hay que ir: estando ahí, tocás **Estoy acá** y te quedás 20 segundos dentro del radio.

## Qué tiene (v1)
- Mapa con tu personaje siguiendo el GPS.
- 8 misiones por día: 3 comunes (cerca), 3 raras (más lejos o lugares nuevos), 2 épicas (más de 900 m). Vencen a medianoche. Una vez por día podés cambiarlas a la zona donde estés.
- XP, niveles y 4 atributos: Fuerza, Curiosidad, Carisma, Resistencia.
- Estadísticas: km caminados (solo a pie: más de ~10 km/h no cuenta), lugares descubiertos, zonas pisadas, racha, últimos 7 días, por tipo y rareza.
- 12 logros.
- Copia de seguridad (exportar e importar).
- Skins: Clásica y Hacker (en Stats → Skin).
- Modo prueba sin GPS: `index.html#demo` (tocás el mapa para moverte; guarda su progreso aparte).

## Privacidad
No hay servidor propio. Tu ubicación no se guarda ni se envía: a OpenStreetMap (Overpass) solo se le consulta qué lugares hay, con el punto redondeado a unos 500 m. El progreso vive en el `localStorage` del navegador.

## Estructura
- `index.html`: la pantalla.
- `css/app.css`: estilos.
- `js/data.js`: tipos de lugar, textos de misiones, rarezas y atributos. Para sumar misiones nuevas, se edita acá.
- `js/app.js`: la lógica del juego.

Mapa: [Leaflet](https://leafletjs.com) + teselas de © OpenStreetMap.
