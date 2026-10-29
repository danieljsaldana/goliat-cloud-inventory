# CI, contribuciones y mantenimiento

## Cuándo se ejecuta cada comprobación

[`dashboard-check.yml`](workflows/dashboard-check.yml) se ejecuta en pull requests a `main`,
en pushes a `main` y manualmente. No se ejecuta además en cada push a una rama de contribución:
la pull request ya cubre ese cambio y evita duplicar ejecuciones.

El job `changes` compara los commits completos, no solo el último commit de la pull request.
Los renombrados se consideran eliminación y adición, para validar ambos lados.
[`ci-changes.mjs`](../scripts/ci-changes.mjs) selecciona los jobs y tiene pruebas sin dependencias.
Si el diff falla, la CI falla: no se omiten pruebas silenciosamente.

| Cambio                                                        | Comprobaciones                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Solo Markdown, texto o plantillas de issues                   | Selector y formato; sin PostgreSQL, build, navegador ni CodeQL                 |
| Panel, backend o pruebas del panel                            | Formato, lint, unitarias, PostgreSQL 17, build de Next.js, Playwright y CodeQL |
| Function                                                      | Formato, lint, pruebas en Node 22, contrato compartido, paquete y CodeQL       |
| Portada estática                                              | Formato, lint y pruebas de la web con Chromium; CodeQL si cambia JavaScript    |
| IaC o scripts de despliegue                                   | Formato, lint, compilación Bicep y pruebas de scripts con CLI Azure ficticia   |
| Contrato de inventario o datos compartidos con la demo        | Se validan también sus consumidores: Function o web estática                   |
| Workflows, dependencias raíz, scripts o rutas no clasificadas | Todas las suites, por precaución                                               |
| Lanzamiento manual                                            | Todas las suites                                                               |

El job `quality` siempre comprueba formato. Solo ejecuta lint si hay cambios que requieren suites de código.
Utiliza las dependencias fijadas por el lockfile, también en las contribuciones de documentación.

## Check obligatorio

`main` exige una pull request y el check **CI**, vinculado a GitHub Actions.
Este check siempre se publica, incluso si solo cambia documentación.
Agrega los resultados de `changes`, `quality`, `tests`, `functions`, `site`, `iac` y `codeql`:
un fallo o cancelación bloquea la integración; una suite no aplicable puede omitirse.
No se ponen filtros `paths` en el workflow obligatorio, porque dejarían pull requests esperando un check inexistente.

La rama debe estar actualizada antes de fusionar y las conversaciones deben estar resueltas.
Se bloquean force pushes y borrados, también para administradores.
No se exige aprobación de otra persona, para permitir el mantenimiento por un único autor.
Las ramas fusionadas se eliminan automáticamente.

## Contribuciones externas

- Se usa `pull_request`, nunca `pull_request_target` para ejecutar código de contribuciones.
- El token tiene lectura por defecto; no se pasan secretos ni credenciales de Azure.
- Los checkouts no conservan credenciales de Git.
- Las ejecuciones de colaboradores externos requieren aprobación del mantenedor.
- Antes de aprobar, revisa especialmente cambios en workflows, dependencias y scripts de instalación.
- Dependabot abre pull requests, pero no se fusionan automáticamente.
- Las ejecuciones anteriores de una misma pull request se cancelan al recibir nuevos commits.

## Pruebas y diagnósticos

El panel usa Node 24, PostgreSQL 17 temporal y datos ficticios.
Las pruebas e2e compilan y arrancan Next.js en el puerto 4100.
Los datos viven en esquemas aislados que se eliminan al terminar.
La Function usa Node 22, igual que su entorno Azure.
El contrato se prueba entre el productor y el normalizador del panel.
La web estática se prueba con `npm run test:site`, sin base de datos.

El job IaC comprueba que PowerShell está disponible, compila todos los Bicep sin login y prueba
los scripts de despliegue y empaquetado con una CLI ficticia. No crea ni destruye recursos reales.
No se despliega infraestructura automáticamente desde una pull request.

Los fallos de navegador publican diagnósticos con retención de siete días.
No hay reintentos automáticos que oculten fallos.

## CodeQL y dependencias

[`codeql.yml`](workflows/codeql.yml) es reutilizable desde CI: se llama solo cuando corresponde.
Además se ejecuta semanalmente y bajo demanda, aunque no haya cambios, para detectar avisos nuevos.
Solo el job de análisis tiene `security-events: write`.
Los resultados aparecen en **Security → Code scanning**; un análisis correcto no garantiza la ausencia de vulnerabilidades.

[`dependabot.yml`](dependabot.yml) propone actualizaciones semanales de npm (web y Function)
y GitHub Actions. Agrupa actualizaciones compatibles; los cambios mayores quedan separados.
Las alertas de dependencias, actualizaciones de seguridad e informes privados están habilitados.

## Publicación de GitHub Pages

[`pages.yml`](workflows/pages.yml) es reutilizable desde CI y se puede lanzar manualmente.
CI solo lo llama desde `main`, después del check **CI** correcto, si han cambiado la web o sus fuentes.
Una pull request, incluso de una rama del propio repositorio, nunca despliega.
El lanzamiento manual también está restringido a `main`.

El workflow prepara `site/` con los diagramas Archify, la imagen social y los datos ficticios.
No publica configuraciones locales, el backend ni el resto de `docs/`.
Usa el entorno `github-pages` (solo `main`) y OIDC, sin secretos añadidos.
Solo el job de despliegue recibe `pages: write` e `id-token: write`.
La aplicación Next.js no se despliega en Pages.

## Proceso del mantenedor

1. Revisa el diff, los requisitos de instalación y que no haya información sensible.
2. Autoriza la ejecución externa si corresponde.
3. Espera al check **CI**; revisa los jobs omitidos y los avisos de CodeQL y Dependabot.
4. Resuelve comentarios y fusiona la pull request actualizada.
5. Si cambió la web, comprueba el despliegue posterior a `main`.
6. Para una versión, crea una release desde un commit de `main` con CI correcta. No publiques desde una pull request.

Consulta [CONTRIBUTING.md](../CONTRIBUTING.md) y [SECURITY.md](../SECURITY.md).
