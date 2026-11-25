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
- **Hallazgos**: cada 30 minutos aparecen cosas cerca tuyo (bolsas de vaccoins, energía, cofres y, a veces, sobres de Vaca o de Vélez). Se agarran solas al pasar cerca: el imán arranca en 60 m y crece con la XP de los últimos 7 días (+5 m cada 200 XP, hasta 120 m; más si el GPS es impreciso; el anillo amarillo punteado alrededor tuyo muestra el alcance). Siempre aparecen al lado de un negocio, plaza o iglesia, así se llega por la vereda. Hasta 25 por día.
- **Conexión con FUNVS**: los vaccoins de hallazgos y niveles (50 por nivel), los sobres y los paseos de Vaca van a tu Colección de FUNVS. Lifebgood escribe `lifebgood.json` en el mismo Gist privado de la Colección y FUNVS lo lee al sincronizar (cada cosa entra una sola vez; tope de 60 vaccoins por día). Se conecta en Stats → FUNVS con el mismo token de GitHub de FUNVS (si FUNVS está abierto en el mismo navegador, lo toma solo).
- **Menú**: todo se abre desde el botón de abajo a la derecha, que despliega las opciones.
- **Aviso de próxima misión**: aparece abajo al centro unos segundos (como mucho cada 40 min; se desliza para ocultarlo) (la próxima de tu agenda o la más cercana del mapa) y se va solo; también avisa cuando pasás cerca de una misión.
- **¿Qué estás haciendo?**: el juego te pregunta cada tanto (o desde el menú → Estoy haciendo…). Entrenar, leer, un proyecto, charlar, ordenar, viajar o rezar arranca un cronómetro y suma a ese atributo (2 XP por minuto, hasta 120; viajando, 1 por minuto hasta 60).
- **Día y hora** siempre arriba, en el recuadro del nivel.
- **Iglesias y Fe**: las iglesias aparecen en el mapa; al pasar por una, la app te propone hacer la señal de la cruz y recarga tu Fe. Fe es también un atributo.
- **Ficha del personaje** (Stats): nivel de cada atributo, Fe, "Cómo me siento hoy" (5 niveles y la semana en barras), peso, IMC y días entrenados.
- **Adiestramiento de Vaca**: trucos con estrellas según cómo les va; se ofrece al terminar de entrenar.
- **Álbum del barrio**: cada lugar que descubrís se pega como estampa, por tipo, con medallas de bronce, plata y oro.
- **Resumen del domingo**: el domingo a la noche te avisa que tu semana está lista.
- **Mapa de calor del mes** (Stats): por dónde caminaste más.
- **Copia en la nube**: con el token de GitHub, el progreso se guarda solo en un Gist privado (`lifebgood-save.json`) y se trae en otro aparato. La primera vez en un aparato gana la copia con más progreso.
- **Sin señal**: la app y los mapas que ya viste quedan guardados en el celu (las actualizaciones aparecen la segunda vez que la abrís).
- **Modo 420**: el botón del espiral vuelve todo psicodélico; tocándolo de nuevo vuelve a la normalidad.
- Logros (en Stats).
- Copia de seguridad (exportar e importar).
- Skins: Clásica y Hacker (en Stats → Skin).
- **Tu agenda** (pestaña Misiones): cargás misiones con texto, por ejemplo `1 pasear a Vaca a las 16`. 1 = principal (80 XP), 2 = secundaria (40 XP), 3 = diaria (20 XP, se repite todos los días). Entiende "hoy", "mañana", "el sábado", "24/11", "a las 16", "16:30", "19hs", "de la tarde". El atributo lo deduce de las palabras, y si lo corregís tocando la etiqueta, aprende para la próxima. Las que repetís aparecen como sugerencias. Si la marcás a más de 1 hora del horario, vale la mitad.
- **Google Calendar y Tasks** (opcional): entran todos tus calendarios propios (los feriados y los compartidos, si los prendés), y elegís qué tipo de misión es cada uno (Automático, Principal o Secundaria). Trae eventos y tareas de hoy a 7 días; las tareas atrasadas pasan a hoy y las sin fecha tienen su sección. Al cumplir una tarea en Lifebgood se tacha sola en Google Tasks. Puede agendar en Google lo que cargás en la app.
- **Conexión con Mente** (notas, calendario y tareas, en `klasito7.github.io/Mente`): lo que agendás en Mente llega acá por Google. Si en Mente elegís "Principal", "Secundaria" o "Solo aviso", Lifebgood respeta ese tipo. Se abre desde el menú → Mente.
- **Más lugares de OpenStreetMap**: además de kioscos, plazas, panaderías, heladerías, verdulerías, cafés e iglesias, hay misiones en supermercados, gimnasios al aire libre, bibliotecas, murales, monumentos, estaciones de tren, canchas de fútbol y caniles.
- **Juegos del barrio**: al llegar a una plaza o cancha se destraban los **penales** (5 tiros deslizando el dedo), en un súper **la caja** (pasar productos por el lector sin cobrar el separador) y en una iglesia **el vitral** (memotest de 8 pares, +20 de Fe). Uno por lugar por día; dan XP (10 a 70 según las estrellas) y hasta 20 vaccoins para FUNVS. En Stats se pueden practicar sin premio.
- **Calles de tu barrio**: cuenta cada tramo de calle que caminás por primera vez (a pie). Al caminar el 80% de una calle de tu zona queda conquistada (+25 XP). En Stats ves el porcentaje del barrio y podés pintar en el mapa las calles caminadas.
- **Para Vaca**: durante el paseo aparecen en el mapa las fuentes de agua y los caniles; el menú del paseo muestra los más cercanos y marca el camino. Llegar a un canil con Vaca da +15 XP (una vez por día por canil).
- **Más rápido**: se guardan las últimas 6 zonas donde estuviste (casa, oficina…) y abren sin esperar a Overpass; si los lugares tienen más de 3 días se actualizan por detrás. Si un servidor de Overpass no responde, prueba con otros dos.
- Modo prueba sin GPS: `index.html#demo` (tocás el mapa para moverte; guarda su progreso aparte).

## Conectar Google Calendar (una sola vez, unos 10 minutos)
Google pide que cada app que lee un calendario esté registrada. Como esta app es tuya, la registrás vos y nadie más tiene acceso.

1. Entrá a https://console.cloud.google.com con tu cuenta de Gmail y creá un proyecto nuevo llamado `Lifebgood`.
2. Menú → **APIs y servicios → Biblioteca** → buscá **Google Calendar API** → **Habilitar**. Después buscá **Google Tasks API** → **Habilitar**.
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
- `js/juegos.js`: los juegos del barrio (penales, la caja y el vitral).
- `js/app.js`: la lógica del juego.

Mapa: [Leaflet](https://leafletjs.com) + teselas de © OpenStreetMap.
