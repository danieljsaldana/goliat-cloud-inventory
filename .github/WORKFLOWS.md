# Pruebas automáticas

## Protección y mantenimiento

`main` exige pull requests y los checks `tests`, `functions` y `CodeQL (JavaScript)`.
No exige aprobación de otra persona, para permitir el mantenimiento por un único autor.
Los force pushes y el borrado de la rama están bloqueados; las ramas fusionadas se eliminan automáticamente.

[`workflows/codeql.yml`](workflows/codeql.yml) analiza JavaScript en pushes y pull requests a `main`,
semanalmente y bajo demanda. No ejecuta la aplicación ni necesita credenciales de Azure.
Los resultados aparecen en **Security → Code scanning**; un análisis correcto no garantiza la ausencia de vulnerabilidades.

[`dependabot.yml`](dependabot.yml) propone actualizaciones semanales para npm (web y Function)
y GitHub Actions. Las actualizaciones compatibles se agrupan y no se fusionan automáticamente.
También están activadas las alertas de dependencias, las actualizaciones de seguridad y los informes privados.
Consulta [SECURITY.md](../SECURITY.md) y [CONTRIBUTING.md](../CONTRIBUTING.md).

[`workflows/dashboard-check.yml`](workflows/dashboard-check.yml) ejecuta las pruebas del producto en cada push, pull request o lanzamiento manual.

[`workflows/pages.yml`](workflows/pages.yml) publica la portada estática de `site/` en GitHub Pages.
Ejecuta `scripts/prepare-site.mjs` para copiar los dos documentos Archify públicos, la imagen social y preparar la demo desde
la semilla ficticia, con sus helpers compartidos de agregación y paginación. No incluye el resto
de `docs/`, configuraciones locales ni código del servidor. Los cambios en los diagramas, la semilla
y los modelos compartidos o la portada social también disparan el despliegue.
La aplicación Next.js no se despliega en Pages.

El job utiliza el entorno `github-pages`, configurado para aceptar despliegues solo desde `main`.
No necesita secretos añadidos al entorno: usa el token de GitHub Actions y OIDC.
En **Settings → Pages**, selecciona **GitHub Actions** como origen. Crear el entorno no publica
los archivos ni activa Pages por sí solo.

El proyecto no conserva un historial anterior: `server/migrations/001_initial.sql` permanece vacío. Las pruebas de integración y navegador inicializan sus esquemas aislados desde `server/schema/initial.sql`, igual que `db:init`. Las pruebas del migrador utilizan SQL temporal independiente.

Instala las dependencias con `npm ci` y ejecuta `npm test` en Node.js 24. El script ya configura la ejecución secuencial para que las pruebas no compitan por el bloqueo de migraciones. Usa un PostgreSQL 17 temporal para comprobar migraciones, semilla e integración con la base de datos. El resto de pruebas verifica normalizadores, autenticación y reglas del repositorio con fixtures y SDK simulados.

El job de la Function usa Node.js 22, igual que su entorno Azure. Su SDK `@azure/functions` es CommonJS: las pruebas importan el módulo por defecto para acceder a `HttpResponse`, sin depender de la detección de exports de Node.js 24. Las pruebas de IaC utilizan Windows PowerShell 5.1 en Windows y `pwsh` en Linux. El puerto de PostgreSQL se valida como un entero JSON entre 1 y 65535, admitiendo tanto `Int32` como `Int64`, porque `ConvertFrom-Json` devuelve tipos distintos según la versión de PowerShell. Se rechazan strings, decimales y valores fuera de rango.

Después instala Chromium y ejecuta `npm run test:e2e`. Playwright compila y arranca Next.js en el puerto 4100, usa sesiones demo reales y prueba el panel en escritorio/español y móvil/inglés. Los datos de navegador viven en un esquema aleatorio separado de las pruebas del backend; se elimina al terminar. Comprueba navegación, filtros, tablas, gráficos, estados y actualización, incluido el bloqueo de Azure visible para dos sesiones.

Si falla una prueba de navegador, publica `playwright-report/` y `test-results/` como artefactos de diagnóstico con retención de siete días. Esos archivos se ignoran en Git y Docker. No hay reintentos automáticos que oculten un fallo.

La preparación de Node y la publicación de diagnósticos usan las versiones actuales de [setup-node](https://github.com/actions/setup-node) y [upload-artifact](https://github.com/actions/upload-artifact). PostgreSQL se comprueba por TCP antes de iniciar las pruebas.

No necesita secrets ni conexiones a Azure o PostgreSQL. La ingesta y las migraciones de producción se ejecutan desde el orquestador del despliegue, como se describe en el [backend](../docs/backend.md).
