# Identidad visual de Goliat - Cloud Inventory

El logo vectorial está en [src/assets/goliat-logo.svg](../src/assets/goliat-logo.svg). Una nube abierta envuelve un bloque isométrico que representa los recursos del inventario. El símbolo acompaña al nombre Goliat en azul; «Cloud Inventory» aparece como descriptor en la cabecera y en el acceso. El favicon y el icono Apple usan el mismo símbolo.

| Uso                              | Color                                  |
| -------------------------------- | -------------------------------------- |
| Marca, botones y selección       | Azul Azure `#0078d4`                   |
| Hover y énfasis                  | Azul profundo `#005a9e`                |
| Texto principal                  | Azul noche `#16324f`                   |
| Fondos y tarjetas                | Blanco `#ffffff`                       |
| Selecciones y superficies suaves | Azul claro `#edf6ff`                   |
| Acentos y gráficos               | Azules `#50b4f2`, `#7b96c7`, `#2864a6` |

Los tokens viven en `src/styles/theme.css` y `src/styles/shadcn.css`. El color principal con texto blanco mantiene contraste AA para texto normal. Los estados de éxito, advertencia y error conservan sus colores funcionales.

La [portada PNG](../public/social/cloud-inventory.png), opaca y de 1730 × 909 píxeles, comparte esta identidad y solo menciona Microsoft Azure. Su [fuente SVG](../public/social/goliat-cloud-inventory.svg) está versionada. El título y la descripción de cada enlace se generan en español o inglés sin incluir datos de inventario.

```bash
npm run assets:brand
```

El símbolo maestro está en `app/icon.svg`. El script `scripts/render-brand-assets.mjs` lo reutiliza para generar el logo, el favicon, el icono Apple con fondo blanco y la portada mediante Sharp. El logo es una creación vectorial del proyecto. `/social/cloud-inventory.png` es pública para las vistas previas; la protección de las páginas y API sigue controlada por el servidor. Las dimensiones de Open Graph y el texto alternativo están en `src/core/sharing/metadata/constants.js` y los catálogos i18n.

## Compartir enlaces

Cada vista tiene un título y una descripción propios en español o inglés. Los metadatos [Open Graph](https://ogp.me/) y Twitter usan la URL absoluta de `/social/cloud-inventory.png`, sus dimensiones y un texto alternativo. `SITE_URL` debe contener la URL pública del despliegue para que tanto la portada como el enlace canónico sean accesibles desde fuera.

Como las redes sociales no tienen una sesión de Goliat, `proxy.js` entrega a sus rastreadores una página HTML estática con esos metadatos en el `<head>`. La vista previa utiliza únicamente los textos públicos del catálogo y la portada; no consulta PostgreSQL, Storage ni la Function. El navegador mantiene el acceso mediante login. La página de acceso también conserva los metadatos del destino cuando `callbackUrl` identifica una vista válida.

El identificador del rastreador no concede permisos: incluso si se imita, solo permite leer esta vista previa de una ruta de página conocida mediante `GET` o `HEAD`. Las API, las escrituras y `/docs/architecture.html` mantienen sus controles de sesión. Los filtros del enlace y las cookies no se incluyen en la vista previa. Su respuesta utiliza `private, no-store` y `noindex, nofollow`; estos metadatos permiten compartir enlaces sin publicar el inventario ni habilitar su indexación.

La implementación está en `server/sharing/` y reutiliza los mismos metadatos que Next.js. Las pruebas `tests/social-preview.test.mjs` y `tests/e2e/sharing.spec.mjs` comprueban los dos idiomas, la portada pública y el acceso protegido. Si una red social conserva una vista previa antigua, vuelve a consultar el enlace con su herramienta de depuración de enlaces; su caché es independiente de la web.

## Portada pública de GitHub Pages

`site/index.html` incluye Open Graph y Twitter Cards directamente en el `<head>`, sin
depender de JavaScript ni de una sesión: título, descripción, URL canónica, nombre del sitio,
imagen PNG absoluta, dimensiones y texto alternativo. Twitter utiliza `summary_large_image`.
La tarjeta usa textos públicos en inglés, como el README principal; cambiar el idioma de la
demo no cambia la tarjeta que leen los rastreadores.

`npm run build:site` copia la portada maestra de `public/social/cloud-inventory.png`
a `site/assets/cloud-inventory.png`. La copia se ignora en Git y el workflow de Pages
se ejecuta también cuando cambia la imagen maestra. Las pruebas de la portada verifican los
metadatos sin JavaScript, la ruta de la imagen y sus dimensiones reales.

La tarjeta solo podrá recuperarse desde redes sociales cuando la web y la imagen estén
publicadas en `https://danieljsaldana.github.io/goliat-cloud-inventory/`. El entorno
`github-pages` es el destino de despliegue del workflow; crearlo no activa ni publica el sitio
por sí solo. Configura Pages con **Source: GitHub Actions** y ejecuta el workflow tras subir los archivos.
