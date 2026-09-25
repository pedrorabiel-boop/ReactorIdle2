# Nucleus · Idle Lab

Prototipo mobile-first de un juego idle energético. Comienza con renovables sencillas y evoluciona hacia plantas térmicas donde deberás transportar calor sin provocar una explosión.

## Probar localmente

Requiere Node.js 22 o una versión compatible.

```bash
npm install
npm run dev
```

Abre la dirección indicada por Vite. La partida se guarda automáticamente en el navegador.

## Economía v2

La energía ya no se convierte inmediatamente en dinero: las oficinas venden primero hasta la potencia comercial del mapa y solo el excedente entra a su banco local. El jugador también puede vender todo ese banco manualmente. Producción, oficinas, baterías, controladores y mejoras son independientes en cada isla. Sin oficina no existe venta automática. Las instalaciones de I+D generan RP pasivamente y el árbol tecnológico usa exclusivamente esos puntos. Eólica, solar y reactores tienen una vida útil corta: al caducar se reconstruyen por su costo completo. Su ciclo inicial produce entre 200 % y 150 % de ese costo, con margen decreciente en tecnologías posteriores. El Laboratorio permite investigar `Auto rebuild` por separado para cada tipo.

Los diez niveles se compran con créditos por tipo de edificio y benefician a todas sus unidades dentro del mapa activo. Sus precios iniciales se balancean individualmente por edificio y luego escalan ×2,2 por nivel; la potencia escala ×1,35, además de los hitos de nivel. El balance oficial actual fue promovido desde una sesión práctica realizada con el editor Debug. `npm run balance` valida la coincidencia exacta con ese perfil, el retorno de vida útil y las relaciones esenciales del circuito térmico.

La red térmica usa difusión resistiva sobre el grafo ortogonal de reactores, tuberías, intercambiadores y acumuladores. Las turbinas generadoras son sumideros terminales híbridos: consumen primero su reserva y luego completan simultánea y equitativamente su conversión desde las celdas adyacentes, sin resistencia en el enlace terminal. Solo el excedente entra pasivamente a su buffer térmico y nunca se retransmite; si supera la capacidad, la turbina se avería. Las tuberías conservan su resistencia, de modo que distancia, bifurcaciones, loops, caminos paralelos y cuellos de botella siguen cambiando el resultado. La conectividad se almacena en caché y solo se reconstruye cuando cambia la topología.

## Interfaz pixel art

La planta ocupa toda la pantalla, se desplaza en horizontal y vertical y permite zoom de 60 % a 160 %. La costa inicial tiene 36 celdas en una silueta irregular. El segundo sector es el Distrito Neón: una región cyberpunk nocturna de 72 celdas construibles, dividida en dos islas de 40 y 32 celdas, con agua oscura, bordes de neón, pilones urbanos y una variación cromática tenue de los edificios. Sobre el mapa flotan el HUD superior (créditos, banco local, ciencia y calor cuando hay térmica) y la barra de pestañas inferior:

- **Construir** abre la bandeja de piezas ya desbloqueadas. Al elegir una pieza, la interfaz se despeja y queda solo **Terminar**: toca una casilla o arrastra para construir y reconstruir varias torres caducadas. Desde la bandeja también se activa **Demoler** y se puede **Deshacer** hasta 20 acciones.
- Tocar cualquier edificio abre su inspector directamente para consultar calor, autonomía y averías, apagar, renovar, reparar o demoler.
- **Mejoras** permite subir por mapa la producción, capacidad térmica y autonomía de cada tipo; nunca se mejora una unidad aislada.
- Las piezas caducadas quedan transparentes y conservan su casilla: se reconstruyen desde el inspector o colocando nuevamente el mismo tipo. Para usar la casilla con otro edificio primero hay que demolerla. Los productores con vida útil no tienen reembolso; las demás piezas recuperan el 85 %.
- **Lab** contiene el árbol tecnológico. Torio desbloquea en un solo avance el reactor, la red térmica completa, el controlador, Oficina de ventas II e I+D II; Fusión desbloquea la Turbina II y la Tubería II. Expansión territorial es una investigación independiente: puede adquirirse apenas se reúnen sus RP, sin completar las tecnologías anteriores, y luego autoriza la compra monetaria de la segunda isla. La Tubería II forma redes presurizadas que extraen calor desde el mayor potencial térmico y lo entregan a turbinas con demanda, respetando el caudal de cada tramo. Los edificios II conservan niveles y valores independientes, editables en Debug; ningún desbloqueo altera la potencia ni la capacidad de la Turbina I. **Manual** introduce la misión de gestión energética, explica los cuatro recursos y documenta las 18 torres por categorías con sus valores dinámicos; los contratos permanecen internamente por compatibilidad, pero ya no ocupan una pestaña principal. El **Menú** superior derecho contiene pausa, velocidad, sectores, telemetría y guardado.
- Desbloquear Torio o Fusión nunca reescala automáticamente tuberías, intercambiadores, acumuladores, enfriadores ni baterías. Su rendimiento cambia únicamente mediante sus mejoras por mapa o valores Debug.
- Fusión desbloquea una Tubería II real e independiente, con valores, mejoras, sprite y configuración Debug propios; no modifica ni reemplaza las Tuberías I construidas.
- Los recursos del HUD conservan su formato compacto; al tocar Dinero, Energía o RP aparece una línea desplazable con el valor exacto.

## Modo Debug

Desde el **Menú** se puede activar un sandbox de balance guardado junto con la partida. Su editor permite habilitar dinero infinito, desbloquear temporalmente todas las torres, modificar créditos y RP actuales, elegir el dinero inicial de un reinicio y ajustar costos, producción, calor, autonomía, almacenamiento, ventas, investigación, mejoras, tecnologías y `Auto rebuild`. El desbloqueo Sandbox no compra investigaciones ni modifica permanentemente el árbol tecnológico. Desactivar Debug restaura inmediatamente el balance y los bloqueos oficiales sin perder la configuración personalizada, para poder alternar entre prueba y juego normal.

Los sprites (16×16) viven en `src/ui/pixel/sprites.ts` como mapas ASCII; el terreno usa autotiling para dibujar costas onduladas y playas alrededor de la tierra. La paleta futurista se convirtió en la identidad cyberpunk del Distrito Neón; la paleta alienígena se conserva para una etapa futura. `npm run mockup` regenera `docs/mockup/index.html`.

## Verificación

```bash
npm test
npm run build
```

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` ejecuta las pruebas, compila y publica el sitio al enviar cambios a `main`.

1. Crea un repositorio de GitHub y sube este proyecto a la rama `main`.
2. En **Settings → Pages**, elige **GitHub Actions** como fuente.
3. Ejecuta el workflow o realiza otro push a `main`.

La aplicación es una PWA: una vez publicada se puede agregar a la pantalla de inicio desde Safari o Chrome y continuar jugando offline después de la primera carga.

La interfaz se verificó a 375, 390 y 768 px de ancho; en pantallas anchas el mapa sigue siendo el fondo y los paneles se centran. Las fuentes pixel se sirven desde `public/fonts` y quedan en la caché del service worker para el uso offline.

El guardado recupera de forma segura datos inválidos y conserva una copia local antes de reiniciar. La PWA incluye iconos PNG de 192 y 512 px; su instalación, activación y recarga totalmente offline se verificaron en un navegador Chromium sobre el build de producción.
