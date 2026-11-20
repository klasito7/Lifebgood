# Lifebgood

Misiones en la vida real sobre el mapa de tu barrio. Cada día aparecen misiones en kioscos, plazas, panaderías, heladerías, verdulerías y cafés reales (datos de OpenStreetMap). Para cumplirlas hay que ir: estando ahí, tocás **Estoy acá** y te quedás 20 segundos dentro del radio.

## Qué tiene (v1)
- Mapa con tu personaje siguiendo el GPS.
- 8 misiones por día: 3 comunes (cerca), 3 raras (más lejos o lugares nuevos), 2 épicas (más de 900 m). Vencen a medianoche. Una vez por día podés cambiarlas a la zona donde estés.
- XP, niveles y 4 atributos: Fuerza, Curiosidad, Carisma, Resistencia.
- Estadísticas: km caminados (solo a pie: más de ~10 km/h no cuenta), lugares descubiertos, zonas pisadas, racha, últimos 7 días, por tipo y rareza.
- **Descubrir**: cada lugar del mapa (kiosco, plaza, panadería…) por el que pasás por primera vez queda en tu colección (+10 XP) y aparece como marcador verde. En Stats ves qué porcentaje de tu zona descubriste.
- **Clima en vivo** (Open-Meteo): con lluvia las misiones de plaza esperan; con sol dan XP doble.
- **Días de Vélez** (fixture de ESPN, el mismo que usa FUNVS): el día que juega, todo da XP doble y aparece la misión de ver el partido.
- **Paseos con Vaca**: botón con Vaca en el mapa. Con GPS cuenta minutos y km (y mantiene la pantalla prendida); también se cargan a mano. Si en tu agenda había "pasear a Vaca", se marca sola. Estadísticas y logros propios.
- **Escudo de racha**: un día sin XP por semana no te corta la racha. Se recarga cada lunes.
- **Diario**: al cumplir una misión anotás qué pasó; queda todo en la pestaña Diario.
- **Duelo semanal**: creás un código, se lo pasás a un amigo y los dos reciben los mismos 5 retos (2 que verifica la app y 3 donde la prueba es lo que escribís). Se pasan el resultado como código por WhatsApp y la app compara. Sin servidor.
- Logros (en Stats).
- Copia de seguridad (exportar e importar).
- Skins: Clásica y Hacker (en Stats → Skin).
- **Tu agenda** (pestaña Misiones): cargás misiones con texto, por ejemplo `1 pasear a Vaca a las 16`. 1 = principal (80 XP), 2 = secundaria (40 XP), 3 = diaria (20 XP, se repite todos los días). Entiende "hoy", "mañana", "el sábado", "24/11", "a las 16", "16:30", "19hs", "de la tarde". El atributo lo deduce de las palabras, y si lo corregís tocando la etiqueta, aprende para la próxima. Las que repetís aparecen como sugerencias. Si la marcás a más de 1 hora del horario, vale la mitad.
- **Google Calendar** (opcional): trae tus eventos de hoy a 7 días como misiones y puede agendar en Google lo que cargás en la app.
- Modo prueba sin GPS: `index.html#demo` (tocás el mapa para moverte; guarda su progreso aparte).

## Conectar Google Calendar (una sola vez, unos 10 minutos)
Google pide que cada app que lee un calendario esté registrada. Como esta app es tuya, la registrás vos y nadie más tiene acceso.

1. Entrá a https://console.cloud.google.com con tu cuenta de Gmail y creá un proyecto nuevo llamado `Lifebgood`.
2. Menú → **APIs y servicios → Biblioteca** → buscá **Google Calendar API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** → tipo **Externo** → nombre `Lifebgood`, tu mail como soporte y contacto → guardá. En **Usuarios de prueba** agregá tu propio Gmail.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo **Aplicación web**. En **Orígenes autorizados de JavaScript** poné `https://klasito7.github.io` (sin barra al final). No hace falta URI de redirección. Crear.
5. Copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`). No es secreto.
6. En Lifebgood: **Stats → Google Calendar** → pegalo → **Guardar**. Se abre la ventana de Google: elegí tu cuenta. Si dice "Google no verificó esta app", tocá **Continuar** (es tu propia app en modo prueba).

Tip: si al título de un evento le ponés `1`, `2` o `3` adelante (por ejemplo `1 Entrenar`), la app usa ese tipo. El permiso dura una hora; después tocás **Sincronizar** y se renueva.

## Privacidad
No hay servidor propio. Tu ubicación no se guarda ni se envía: a OpenStreetMap (Overpass) solo se le consulta qué lugares hay, con el punto redondeado a unos 500 m. El progreso vive en el `localStorage` del navegador. Si conectás Google Calendar, los eventos viajan directo de Google a tu navegador; no pasan por ningún otro servidor. El clima se pide con tu ubicación redondeada a ~1 km. El fixture de Vélez no usa tu ubicación.

## Estructura
- `index.html`: la pantalla.
- `css/app.css`: estilos.
- `js/parse.js`: el que entiende las frases de la carga rápida.
- `js/data.js`: tipos de lugar, textos de misiones, rarezas y atributos. Para sumar misiones nuevas, se edita acá.
- `js/app.js`: la lógica del juego.

Mapa: [Leaflet](https://leafletjs.com) + teselas de © OpenStreetMap.
