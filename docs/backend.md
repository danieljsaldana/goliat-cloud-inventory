# Backend y evolución del esquema

El backend es un monolito modular. Web, jobs de ingesta y migrador comparten versión. La web también ejecuta la ingesta al pulsar «Actualizar», reutilizando los mismos servicios que el CLI. El productor independiente de [functions/](../functions/README.md) publica JSON en Storage mediante timer y worker de cola. Tiene sus propias dependencias y despliegue; el backend del dashboard sigue leyendo el documento publicado.

```text
Route Handlers / CLI
        │
        ▼
server/modules/azure/     Inventario Azure
        │
        ├── services/          Orquestación y casos de uso
        ├── storage/           SDK y lectura de Blob Storage
        ├── normalization/     Contratos y transformación sin I/O
        ├── queries/           Validación de filtros y paginación
        ├── repositories/     Consultas y persistencia del proveedor
        └── seed/             Generación y fixtures de prueba propios
        │
        ▼
server/db.mjs             Pool, transacciones e inserción por lotes
        │
        ▼
PostgreSQL genérico       Snapshots Azure

server/database/          Migraciones y comprobación del esquema
server/schema/            Esquema inicial de una base nueva
server/migrations/        Runner SQL; sin historial previo
server/seed/              Coordinación de la semilla en una transacción
server/auth/ y access/    Autenticación y autorización del panel
server/logging/           Logs y contexto compartidos
```

El módulo Azure reúne sus capas bajo `server/modules/azure/`. Los Route Handlers y el CLI entran por `services/`; una lectura no importa el SDK del colector. ESLint separa Storage, normalización y persistencia, impide SDK en repositorios y mantiene los normalizadores libres de I/O. La autenticación de Entra ID pertenece a `server/auth/`, independiente del inventario.

La semilla reutiliza los repositorios Azure. Comprueba la base bajo bloqueo antes de escribir y publica las 73 vistas en una transacción. Un fallo revierte la operación completa. `server/commands.mjs` selecciona los casos de uso del CLI.

Si también falla el `ROLLBACK`, el backend registra el fallo, descarta la conexión del pool y conserva el error original. Esa conexión no se reutiliza para otra petición.

El [diagrama Archify de la aplicación](architecture.html), generado desde [architecture.json](architecture.json),
separa el flujo de inventario de las consultas FinOps a Cost Management. Los módulos de normalización
forman parte del backend; no representan servicios desplegados independientes. La portada pública reutiliza
los mismos documentos mediante `npm run build:site`.

Los lectores de Blob Storage no importan repositorios ni acceden a PostgreSQL. La recogida desde Resource Graph/ARM y la publicación pertenecen al proyecto `functions/`. Los lectores, normalizadores y persistencia del panel están bajo `server/`. Los normalizadores reciben datos y devuelven un contrato sin acceder al SDK, al reloj ni a la base. La ingesta fija el ETag durante la descarga. El repositorio Azure serializa publicaciones, omite un ETag ya activo y conserva una generación más reciente si llega una lectura antigua del mismo origen. Los servicios permiten inyectar origen, normalizador y persistencia para probar fallos sin una cuenta cloud.

## Contratos de datos

Azure utiliza `AzureRawSnapshot → AzureSnapshot`: un documento versionado de Blob Storage contiene catálogo de suscripciones, filas por informe, totales y etiquetas, que se transforman en las 73 tablas existentes. Se conservan `false`, `0`, campos vacíos, IDs y etiquetas. El snapshot se publica en una transacción; el lector obtiene una vista consistente aunque otro job publique uno nuevo. `metadata.normalizationVersion` identifica la versión del normalizador.

El normalizador está en `server/modules/azure/normalization/`. Su versión es independiente del esquema SQL. Cambiarlo no transforma el histórico: adaptar snapshots o volver a recopilar Azure con un backfill explícito. Las filas existentes sin versión en metadata corresponden a la versión 1.

## Documento Azure en Blob Storage

El productor de `functions/` publica un JSON UTF-8 completo en el blob configurado por `AZURE_STORAGE_BLOB` (`azure/latest.json` por defecto). Su identidad necesita escritura de blobs; la identidad del backend necesita lectura. Publica después de completar la recogida y validación, con lease compartida y condición ETag para conservar una generación completa.

```json
{
  "schemaVersion": 2,
  "provider": "azure",
  "generatedAt": "2026-10-09T05:00:00.000Z",
  "snapshot": {
    "catalog": [],
    "tagKeys": [],
    "reports": [],
    "totals": [],
    "tags": []
  }
}
```

La estructura abrevia el contenido: los arrays vacíos de catálogo e informes no forman un documento válido. El contrato requiere:

- `generatedAt`: fecha de generación UTC en formato ISO canónico, como el ejemplo. Es la fecha mostrada por el panel.
- `catalog`: al menos una suscripción con `subscriptionId` único y `subscriptionName`; admite también `state` y `tenantId`.
- `tagKeys`: claves únicas, sin distinguir mayúsculas, para columnas y agrupaciones de etiquetas. Pueden obtenerse de los datos recogidos; su configuración pertenece al productor.
- `reports`: los 69 informes brutos, cada uno con `id`, `headers` y `rows`. Los IDs requeridos están en [`RAW_REPORT_IDS`](../server/modules/azure/documentConstants.mjs), calculados desde el catálogo compartido. `headers` es un array de nombres de columna y `rows` contiene objetos JSON; los informes sin recursos mantienen sus columnas y `rows: []`. Conservar las etiquetas originales en las filas.
- `totals`: objetos con `subscriptionId`, `resources` y `distinctTypes`, con los totales por suscripción.
- `tags`: objetos con `subscriptionId`, `resourceProvider`, `type`, `resources` y `tagsJson`; este último contiene las etiquetas como JSON serializado para las agrupaciones.

El backend deriva las vistas `subscriptions`, `resource-totals`, `tags-by-subscription` y `tags`, y valida las 73 vistas antes de publicar. El [fixture de las pruebas](../tests/fixtures/azure-document.mjs) construye un documento válido mínimo como referencia. El validador rechaza versiones desconocidas, duplicados e informes incompletos.

La descarga usa ETag con `If-Match` y el límite `AZURE_MAX_OBJECT_MB`. Si cambia el blob durante la lectura o falla la validación, se conserva el snapshot anterior. Repetir el mismo ETag no crea otro snapshot. El código, las dependencias y el despliegue del productor se gestionan en su repositorio.

## Actualización manual

El botón llama a `POST /api/inventory/azure/refresh/`, con sesión obligatoria y origen válido. El backend solicita una generación autenticada a la Function y devuelve `202` con el ID. La UI consulta GET de la misma ruta con `?operationId=<ID>`; tras `succeeded`, envía otro POST con ese ID para leer el blob con el ETag confirmado, normalizar y persistir. La [guía de Azure Functions](azure-function.md#6-integración-con-el-dashboard) detalla autenticación, estados y configuración.

La UI espera generación e importación y después consulta la API de PostgreSQL, manteniendo la suscripción, los filtros y la página. El toast muestra actualización en curso, confirmación o error. Una apertura de vista o un cambio de filtro sigue consultando únicamente PostgreSQL. `npm run collect:azure` sigue siendo una importación directa de Storage, sin generación.

Las actualizaciones manuales utilizan un bloqueo de sesión en PostgreSQL. Se adquiere antes de leer Blob Storage y se mantiene hasta persistir el snapshot. Todas las sesiones y réplicas comparten el bloqueo. Un segundo POST devuelve `409 refresh_busy`. Se libera al terminar, fallar o cerrar la conexión. [Bloqueos advisory de PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).

El GET de cada endpoint de actualización consulta el bloqueo sin modificarlo. Los botones comprueban ese estado cada cinco segundos y al recuperar el foco, se deshabilitan mientras otro usuario actualiza y muestran un aviso si dos clics coinciden antes de detectar el cambio. Si no se puede consultar el estado, permanecen deshabilitados hasta recuperar la conexión. La comprobación de estado no genera logs de éxito periódicos.

La sesión que mantiene el bloqueo se reutiliza para las consultas y transacciones de la importación, sin consumir otra conexión del pool durante la escritura. Un pool separado, limitado a tres conexiones por proceso web, permite mantener la actualización Azure activa y atender las peticiones concurrentes que deben rechazarse; la API de lectura usa su pool habitual. Si se pierde la sesión, se cancela la lectura cloud y esa sesión ya no puede guardar datos. Los jobs del CLI conservan su ejecución independiente y la deduplicación de persistencia.

`INVENTORY_REFRESH_TIMEOUT_MS` limita la espera manual: 120000 ms por defecto, máximo 900000. El plazo y la desconexión se propagan a la lectura de blobs; SQL conserva `DB_QUERY_TIMEOUT_MS`. La publicación del snapshot completo es atómica y un fallo conserva los datos anteriores.

La identidad de la web necesita lectura en Blob Storage y permisos DML en PostgreSQL para la actualización manual. Usa `AZURE_*` y `DB_*`, igual que el job Azure. El migrador es el único proceso con DDL. No queda trabajo oculto después de finalizar el POST.

## Escalar sin cambiar la arquitectura

- La web no ejecuta colectores ni migraciones en su arranque. Puede replicarse detrás de un balanceador; Auth.js comparte `AUTH_SECRET` y `AUTH_URL` entre réplicas.
- Cada proceso tiene un pool acotado por `DB_POOL_SIZE`; la web añade hasta tres conexiones para actualizaciones manuales. Presupuestar conexiones como `réplicas × (pool + 3) + colectores + migrador + margen operativo`, incluidos los procesos que coinciden durante un despliegue. El migrador utiliza una conexión. El pool de actualización necesita una sesión estable hasta liberar su bloqueo; un proxy debe conservar esa sesión. El migrador debe conectarse directamente a PostgreSQL con un usuario DDL.
- El productor incluido genera diariamente el inventario completo; programar un job de ingesta después de confirmar su publicación. Su snapshot sigue siendo global: lanzar jobs independientes por suscripción reemplazaría el conjunto visible con el último resultado parcial. Antes de paralelizar por ámbito, hay que añadir almacenamiento/publicación por ámbito y un coordinador de la generación completa.
- El backend descarga y normaliza un blob limitado por `AZURE_MAX_OBJECT_MB`. Los grandes volúmenes necesitarán escritura por lotes en una generación provisional antes de publicar su cabecera. Los repositorios separan ese cambio del SDK y la UI.
- El dashboard conserva su endpoint de snapshot completo. Para vistas grandes existe `GET /api/inventory/azure/<reportId>/?limit=100&scope=<subscriptionId>`: pagina por `row_index`, sin OFFSET, con máximo 500 filas. Las siguientes páginas deben enviar `after=<nextCursor>` y `runId=<runId>` para mantener la misma generación mientras llega otra. Un snapshot eliminado devuelve 404 y el cliente deberá reiniciar la lectura. La UI actual todavía usa el endpoint completo; conectar las tablas a esta API es el siguiente paso cuando lo exija el volumen.
- Actualmente se conservan generaciones de inventario. Definir retención según necesidades de auditoría antes de automatizar borrados; no eliminar la cabecera activa ni snapshots que todavía necesiten los lectores.

Dimensionar los pools según [node-postgres](https://node-postgres.com/guides/pool-sizing). Si se introduce un pooler, el bloqueo advisory de actualización necesita conservar la misma sesión durante toda la operación.

## Logs y trazabilidad

`server/logging/` centraliza configuración, serialización segura y contexto con `AsyncLocalStorage`. `LOG_ENABLED`, `LOG_LEVEL` (`info`, `warn`, `error`) y `LOG_HTTP_ENABLED` controlan la salida. El logger se crea una vez por proceso, filtra por nivel antes de serializar y escribe JSON en `stderr` con mensajes en español. Los logs se recogen desde el entorno del contenedor; no requieren una base ni disco local.

Las peticiones usan un `requestId` validado o generado, devuelto en `X-Request-ID`; el proxy lo propaga a las API. Cada contexto concurrente mantiene su ID. Las operaciones del CLI comparten `operationId` con la ingesta, la semilla y las migraciones. Las API emiten un resumen con duración, estado y ruta del handler, sin el query string. Las comprobaciones de salud correctas y los accesos autorizados del proxy no generan resúmenes. Un 4xx es una advertencia y un 5xx un error; una petición API superior a un segundo también es una advertencia.

Las ingestas resumen los informes Azure y si la publicación se ha omitido, y las migraciones registran solo ficheros confirmados. Los errores del pool y de Auth.js pasan por el mismo logger. `instrumentation.js` registra inicio y errores de servidor capturados por Next.js. Los errores externos se serializan con tipo y código; sus mensajes, causas y stack se omiten. La redacción adicional oculta campos de credenciales conocidos. Los resultados del CLI siguen en `stdout`; los logs no rompen su consumo como JSON.

## Cuándo ejecutar las migraciones

El proyecto empieza sin historial previo. Para una base vacía, ejecutar `db:init`: crea las tablas definidas en `server/schema/initial.sql` dentro de una transacción y registra versión y SHA-256 en `inventory_schema`. Es repetible, bloquea inicializaciones simultáneas y rechaza tablas ajenas. `iac/deploy-project.ps1` lo ejecuta antes de publicar la web. `001_initial.sql` permanece vacío. El procedimiento siguiente describe cómo preparar futuras evoluciones SQL cuando sean necesarias.

**Antes de enviar tráfico a la nueva versión**, como un job de despliegue independiente. El proceso web nunca ejecuta DDL.

1. Construir web, collector y migrator con la misma versión o digest inmutable.
2. Comprobar backup/PITR y probar la actualización sobre una copia representativa de la base. La CI prueba instalación, actualización, rollback de una migración fallida y bloqueo de ejecuciones simultáneas.
3. Ejecutar `db:status` y el job `db:migrate` contra el endpoint writer directo, con un usuario DDL exclusivo. Si falla, detener el despliegue y mantener la versión anterior.
4. Ejecutar `db:check`. Arrancar las nuevas réplicas y esperar `GET /api/ready/` con 200; después incorporarlas al balanceador.
5. Actualizar los colectores a la misma versión. Ejecutar backfills largos como jobs reanudables separados.
6. Retirar réplicas y colectores anteriores. Eliminar columnas o restricciones antiguas en una versión posterior, cuando ya no exista ningún consumidor antiguo.

Mientras está activo el servicio anterior, se pueden aplicar cambios **aditivos y compatibles**, revisando duración y bloqueos: añadir campos opcionales o con un default compatible, nuevas tablas y adaptaciones que permitan convivir a ambos binarios. Renombrar o eliminar una columna consumida requiere expandir, migrar datos, desplegar consumidores nuevos y contraer en otra versión. Si el cambio no puede convivir, programar mantenimiento; readiness no convierte un DDL destructivo en compatible.

PostgreSQL puede bloquear lecturas y escrituras con determinados DDL. El migrador limita `lock_timeout` a 5 segundos y `statement_timeout` a 15 minutos por defecto. Un timeout revierte la migración actual y aborta el despliegue. Ajustar límites tras medir el cambio, no para ocultar una operación larga. Véase [bloqueos PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html).

Este runner admite **SQL transaccional**: cada fichero y su registro se confirman juntos. No incluir `BEGIN`, `COMMIT` ni operaciones no transaccionales. `CREATE INDEX CONCURRENTLY` no puede ejecutarse dentro de una transacción; para un índice grande se necesita un job operativo específico, con seguimiento y reparación de índices inválidos, o ampliar el runner con soporte explícito para migraciones no transaccionales. No retirar la transacción de todas las migraciones. [Restricciones de CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html).

## Comandos y controles

```bash
npm run db:status   # Solo lectura: aplicadas, pendientes, drift y ficheros desconocidos.
npm run db:init     # Crea el esquema inicial en una base vacía; es repetible.
npm run db:migrate  # Aplica las pendientes con bloqueo exclusivo entre migradores.
npm run db:check    # Sale con código distinto de cero si el esquema no está preparado.
```

`001_initial.sql` permanece vacío. Los ficheros vacíos se omiten: `db:migrate` termina sin conectar a PostgreSQL ni crear `schema_migrations` si no hay SQL ejecutable. En este proyecto, `db:status` y readiness verifican el esquema inicial: versión, checksum y existencia de las tablas. Repetir `db:init` no cambia datos; modificar el SQL después de inicializar provoca un rechazo. Para futuras evoluciones, diseñar SQL consecutivo y compatible antes de activar el runner de migraciones. Su registro conserva nombre, SHA-256 y fecha; cambiar SQL aplicado, introducir huecos o ejecutar un migrador antiguo sobre un histórico más nuevo aborta antes de aplicar DDL.

El bloqueo advisory se mantiene en una sesión dedicada y se libera al terminar; si falla su limpieza, se descarta la conexión. Dos migradores no ejecutan el mismo cambio simultáneamente. Las migraciones anteriores de un lote que ya hayan confirmado permanecen aplicadas si falla una posterior. Corregir la migración todavía no aplicada y reintentar; si el problema está en un cambio confirmado, añadir un nuevo SQL de reparación. No borrar el historial para hacer que un checksum coincida.

`DB_MIGRATION_HOST`, `DB_MIGRATION_USER` y `DB_MIGRATION_PASSWORD` permiten credenciales DDL independientes, con fallback a `DB_*` para local. En producción separar los secretos por proceso: web y colectores con lectura y DML para la ingesta, migrador con DDL; todos necesitan leer el historial para las comprobaciones pertinentes. Aplicar también los grants para las tablas futuras. Un usuario web sin DDL es una barrera adicional frente a migraciones accidentales.

`/api/health/` comprueba vida del proceso. `/api/ready/` comprueba conexión y esquema inicial, sin revelar nombres, credenciales ni errores SQL en su respuesta. Docker utiliza readiness en su healthcheck. Configurar también esa ruta en el balanceador/orquestador; las rutas de datos no ejecutan DDL.

## Ejemplo de despliegue

```bash
set -e
docker build --target migrator -t cloud-inventory-migrator:VERSION .
docker build --target runner -t cloud-inventory-web:VERSION .
docker build --target collector -t cloud-inventory-collector:VERSION .
docker run --rm --env-file .env.migrations -v "$PWD/certs:/app/certs:ro" cloud-inventory-migrator:VERSION
docker run --rm --env-file .env.migrations -v "$PWD/certs:/app/certs:ro" cloud-inventory-migrator:VERSION schema-check
# Solo después de un exit 0: arrancar la nueva web y comprobar /api/ready/.
```

`.env.migrations` contiene conexión PostgreSQL y credenciales DDL. `.env` contiene DML, lectura de Blob Storage y autenticación web. `.env.azure` contiene DML y las credenciales del colector. Todos están ignorados por Git. TLS verifica certificados con las CA del sistema; `DB_SSL_CA_PATH` permite indicar una CA PEM propia montada en los contenedores.

[`compose.example.yaml`](../compose.example.yaml) muestra la dependencia `service_completed_successfully` entre el job de inicialización y la web. Crear los archivos de entorno a partir de `.env.example`, adaptar los secretos y montar `certs` en cada servicio antes de usarlo. La imagen `migrator` ejecuta `init` por defecto; pasar `migrate` explícitamente para futuras evoluciones. El despliegue completo de Azure está en [`iac/PROJECT.md`](../iac/PROJECT.md).

## Vaciar datos durante desarrollo

Si se conserva el esquema, conservar también `inventory_schema` y volver a ingerir datos. Si se recrea una base local desde cero, ejecutar `db:init` antes de ingerir. La inicialización no borra ni reinicia una base con tablas existentes.

## Semilla de desarrollo

`npm run db:seed` se ejecuta después de `db:init`. Valida los JSON ficticios Azure y confirma sus 73 vistas en una transacción, reutilizando los repositorios. No añade tablas ni migraciones para datos de ejemplo.

El comando omite snapshots ya cargados, bloquea escrituras concurrentes durante la comprobación e inserción, rechaza datos ajenos a la semilla y no se ejecuta con NODE_ENV=production. No vacía la base. Las pruebas usan esquemas aislados en una base terminada en _test.

## PostgreSQL independiente del alojamiento

La aplicación usa el protocolo PostgreSQL mediante `pg`, sin SDK de base de datos específico de cloud. Configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. Se admite PostgreSQL local, autogestionado o un servicio administrado, incluido Azure Database for PostgreSQL. `DB_SSL=true` verifica certificados y hostname con CA del sistema o el PEM opcional `DB_SSL_CA_PATH`; para un servidor local sin TLS, establecer `DB_SSL=false`.

El esquema inicial de este proyecto está en `server/schema/initial.sql`. El módulo activo, las API, la semilla y los jobs son exclusivamente Azure.
