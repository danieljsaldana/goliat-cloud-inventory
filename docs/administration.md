# Administración de Goliat

La [demo pública](../site/index.html) reproduce las secciones de esta pantalla con datos sintéticos.
Reutiliza sus textos, períodos de métricas, formatos de tamaño, validación de etiquetas y comparación
de snapshots. Permite inspeccionar muestras horarias, cambiar de gráfica, editar horario y etiquetas,
y explorar escenarios de servicios no disponibles o generación en curso. Los cambios permanecen
en memoria; no consulta ni modifica Azure, Microsoft Graph o PostgreSQL. Los nombres `*.demo.example`
y los identificadores mostrados en la demo son ficticios.

La sección **Administración** aparece en la navegación superior para los usuarios autorizados de Microsoft Entra ID. Está disponible en `/es/admin/` y `/en/admin/`.

## Dar acceso

El acceso utiliza el **ID de objeto del usuario en el tenant del dashboard**. No utiliza nombre, correo, UPN ni el tipo Miembro/Invitado. No requiere convertir al usuario en administrador del directorio o de la suscripción.

Por ejemplo, para autorizar a un usuario por su ID de objeto de Entra ID:

```powershell
.\iac\configure-administration.ps1 -ObjectIds '<object-id-del-usuario>'
```

El script guarda la lista en `administration.objectIds` del archivo privado `iac/.azure/goliat-dev.project.local.json`, configura App Service y despliega los permisos de la identidad web. Se necesita publicar también el código web que incluye este panel; `deploy-project.ps1` automatiza todo.

Para varios administradores, configura `administration.objectIds` con sus GUID y ejecuta el script sin `-ObjectIds`. Para revocar el acceso, elimina el GUID y vuelve a ejecutarlo. La lista se evalúa en cada petición del servidor. Después de habilitar el panel por primera vez, el usuario debe **cerrar sesión y volver a entrar** para incorporar `oid` y `tid` a su sesión.

En desarrollo, configura `DASHBOARD_ADMIN_OBJECT_IDS` con GUID separados por comas y `AZURE_FUNCTION_RESOURCE_ID` con el ID ARM de la Function. El modo demo y el acceso sin autenticación no tienen Administración.

## Qué muestra

- Estado, región, runtime, memoria configurada y límite de instancias por grupo de escalado.
- Ejecuciones totales, memoria media y CPU media durante las últimas 24 horas, con gráficas por hora en UTC.
- Programación del timer, activación y pausa, frecuencia diaria o cada 1, 2, 3, 4, 6, 8 o 12 horas.
- Fecha del inventario importado, número de vistas y errores, estado e ID de la última generación solicitada por HTTP.
- PostgreSQL: conexión comprobada, base de datos, servidor, versión, TLS de la conexión actual, tamaño y vistas/filas del inventario importado.
- Blob Storage: accesibilidad del archivo, contenedor, ruta, endpoint, tamaño, nivel de acceso, cifrado y última modificación.
- Gráficas shadcn de PostgreSQL: CPU y memoria, conexiones y disco del servidor; Blob Storage: solicitudes, entrada/salida de datos y latencia.
- Aviso cuando el archivo publicado en Storage difiere del importado en la web, con acceso al dashboard de Azure.
- Enlace directo a la Function en Azure Portal.
- Panel de etiquetas a monitorizar debajo de Estado del inventario: búsqueda, selección de nombres y detección automática.

Las métricas proceden de Azure Monitor y pueden aparecer con retraso. Los datos ausentes se muestran como no disponibles, sin sustituirlos por cero. Las ejecuciones incluyen los endpoints HTTP, consultas de estado y el timer; no equivalen al número de inventarios generados. La memoria es el working set medido por Azure y puede incluir varios procesos. El estado `Running` es el estado del recurso; no garantiza que cada operación haya funcionado. No se crean Application Insights, Log Analytics ni recursos de monitorización adicionales. La [referencia de métricas de Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/monitor-functions-reference) describe las métricas disponibles.

**Consultar Azure** vuelve a leer métricas, configuración, PostgreSQL y propiedades del archivo publicado en Storage. La primera consulta muestra esqueletos de carga; al volver a consultar, los datos anteriores permanecen visibles y los controles de programación esperan a que termine. Si falla la consulta, se conserva la información anterior con un aviso y se puede reintentar. El navegador limita cada consulta a 45 segundos. Este botón consulta información; la generación e importación del inventario se solicita con **Actualizar** en el dashboard de Azure.

Las tarjetas de PostgreSQL y Storage sustituyen al resumen de recursos en Administración. PostgreSQL se consulta con una transacción de solo lectura y un límite de diez segundos por consulta: versión, tamaño real de esta base de datos, TLS de la conexión y número de vistas y filas del inventario actual. El [tamaño de PostgreSQL](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-DBSIZE) incluye índices y datos de la base; no equivale al disco reservado del servidor Azure. Storage reutiliza la lectura de propiedades del blob: su tamaño corresponde únicamente al archivo del inventario. «Archivo accesible» confirma el acceso desde el backend de la web, no el acceso público anónimo ni el estado de todos los blobs de la cuenta. Los fallos de cada servicio se muestran como no disponibles sin convertirlos en cero ni ocultar las métricas y la programación. No se devuelven contraseñas, usuarios de conexión, cadenas de conexión ni tokens.

## Gráficas de PostgreSQL y Storage

Cada tarjeta incluye una gráfica interactiva con controles shadcn y tooltip. PostgreSQL muestra CPU y memoria juntas, conexiones del servidor o disco utilizado. Blob Storage permite alternar entre solicitudes por hora, tráfico de entrada/salida y latencia del servidor. Los detalles de conexión y del archivo se pueden desplegar debajo de las gráficas.

El selector de período de shadcn permite consultar **1, 6, 12, 24 o 48 horas, o 7 días completos en UTC**, con muestras por hora. El período inicial es de 24 horas y se comparte entre las gráficas de la Function, PostgreSQL y Blob Storage. Los contadores y el tráfico se suman; los porcentajes, conexiones, disco y latencia muestran la media de las muestras horarias disponibles. Un dato ausente deja un hueco: no se dibuja como cero ni se unen líneas a través de ese hueco. La falta de configuración, un `403`, una métrica sin muestras y un fallo de consulta tienen mensajes diferentes. Las gráficas siguen siendo independientes del acceso SQL o al archivo.

Las métricas PostgreSQL corresponden a **todo el servidor**, no solo a `cloud_inventory`: las conexiones incluyen los distintos estados de sesión, y el disco incluye bases, WAL y logs. Las métricas de Blob corresponden a **todos los contenedores de Blob de la cuenta**, incluidos los paquetes y el estado de la Function. El tráfico saliente de esta gráfica no equivale al tráfico facturable. No se activan métricas avanzadas por contenedor, diagnósticos, Application Insights ni Log Analytics. [Métricas de PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/monitor/concepts-monitoring), [métricas de Blob Storage](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/supported-metrics/microsoft-storage-storageaccounts-blobservices-metrics).

La configuración utiliza `AZURE_POSTGRES_RESOURCE_ID` y `AZURE_STORAGE_RESOURCE_ID`, con el ID ARM completo del servidor y de la cuenta. IaC y `configure-administration.ps1` los establecen automáticamente. Para PostgreSQL externo conserva el primero vacío: el acceso SQL sigue funcionando, y las gráficas Azure de ese servidor quedan sin configurar.

`iac/administration.bicep` añade el rol **Goliat Data Metrics Reader**, con únicamente `Microsoft.Insights/metrics/read`, asignado a la identidad web en el servidor PostgreSQL creado por el proyecto y en su cuenta Storage. No concede configuración, escritura ni lectura de datos en esos recursos. Los permisos SQL y de lectura del inventario siguen siendo los anteriores. Para habilitarlo en un entorno existente, publica el código web y ejecuta:

```powershell
.\iac\configure-administration.ps1
```

El despliegue completo con `.\goliat.ps1 deploy` también configura todo. Las métricas se leen mediante tres peticiones ARM agrupadas; cada consulta tiene un límite de quince segundos. No se consulta Azure desde el navegador ni se entrega el token al cliente. Este código y los permisos deben desplegarse para que las nuevas gráficas aparezcan en la web de Azure.

La sincronización compara el ETag del archivo importado con el del blob publicado. Si coinciden, se confirma que se importó esa versión. Si difieren, se avisa del cambio; las fechas permiten distinguir una publicación más reciente de una anterior. Cuando faltan ETags, fechas iguales solo indican coincidencia de fechas. `lastModified` no se utiliza como sustituto de la fecha de generación para decidir la sincronización.

## Elegir etiquetas

En **Etiquetas a monitorizar**, desactiva **Mostrar todas las etiquetas automáticamente** y marca los nombres que quieras mostrar como columnas. Los nombres se descubren a partir de las etiquetas de Azure recogidas en el inventario; puedes buscarlos y seleccionarlos, sin introducir etiquetas manualmente. Guarda la selección y pulsa **Actualizar** en el inventario para generar el documento con esas columnas e importarlo en la web. Si no eliges ninguna, activa el modo automático: una lista vacía significa detectar todas, incluidas las nuevas etiquetas.

La selección se guarda en `INVENTORY_TAG_KEYS` de la Function y afecta a todos los usuarios. Los nombres se comparan sin distinguir mayúsculas y minúsculas; los recursos sin una etiqueta muestran una celda vacía. Se conservan todas las etiquetas originales en `tags_json`, por lo que una etiqueta oculta puede volver a seleccionarse. Guardar reinicia brevemente la Function y se bloquea durante una generación en curso; si otro administrador modifica la selección, hay que consultar de nuevo antes de guardarla.

Para la recogida local con `npm --prefix functions run collect`, configura `INVENTORY_TAG_KEYS=Environment,Project,Tier` en el `.env` de la raíz. Este comando solo importa esa variable del archivo, con prioridad del entorno del terminal sobre `.env` y después `functions/local.settings.json`. El host local de Functions usa `local.settings.json`. En Azure, `.env` no se publica: el panel guarda el ajuste remoto y IaC lo configura desde `inventory.tagKeys`. Alinea ese valor antes de volver a desplegar infraestructura para conservar la elección.

## Guardar la programación

Todos los horarios son **UTC**, sin cambio de horario de verano. La frecuencia por horas se alinea con medianoche UTC, por ejemplo cada 6 horas: 00:00, 06:00, 12:00 y 18:00. No se ejecuta una generación inmediata al guardar.

El formulario utiliza controles de shadcn, muestra la frecuencia actual en lenguaje natural y permite desplegar su expresión cron. **Guardar programación** se habilita cuando hay cambios; **Descartar cambios** recupera la configuración consultada sin escribir en Azure. Antes de guardar se muestra el aviso de posible reinicio de la Function.

El servidor valida la frecuencia y cambia únicamente `INVENTORY_SCHEDULE` y `AzureWebJobs.inventoryTimer.Disabled`, conservando el resto de app settings. Azure puede reiniciar la Function al aplicar el cambio. Se rechaza guardar si hay una generación HTTP registrada en curso. El bloqueo de PostgreSQL impide escrituras simultáneas desde varias instancias de Goliat y la versión de programación rechaza formularios obsoletos. Evita editar simultáneamente la configuración en Azure Portal o mediante otro despliegue: esos cambios externos no participan en el bloqueo de la aplicación, y la [API de Azure sustituye el conjunto de app settings](https://learn.microsoft.com/en-us/rest/api/appservice/web-apps/update-application-settings?view=rest-appservice-2024-11-01).

El **timer publica en Storage**. El botón **Actualizar** del dashboard solicita una nueva generación, espera su publicación, importa el blob confirmado a PostgreSQL y recarga las vistas. Por eso una generación del timer puede ser más reciente que el inventario mostrado en la web.

La configuración del panel modifica Azure. Para conservarla en futuros despliegues de infraestructura, copia su cron a `inventory.schedule` y su pausa a `inventory.disableTimer` en el archivo privado del proyecto. Un despliegue completo vuelve a aplicar esos valores de IaC; el despliegue de código de la Function con `-CodeOnly` los conserva.

## Autorización y permisos

La página está protegida en el servidor y las API comprueban sesión, modo Entra, tenant y ID de objeto. Las API devuelven `401` sin sesión y `403` a los demás usuarios. Los POST requieren el mismo origen de la web. Las actualizaciones de sesión del navegador no pueden asignar identidades ni permisos de administrador.

La web usa su identidad administrada para llamar a Azure Resource Manager. `iac/administration.bicep` define un rol propio con lectura del recurso, métricas y configuración, y escritura de configuración. La asignación se limita a **la Function de este entorno**. Azure permite escribir configuración con ese permiso; el backend de Goliat limita su API al timer y a `INVENTORY_TAG_KEYS`. El servidor necesita leer los app settings para conservarlos, pero nunca devuelve el conjunto completo al navegador ni lo registra en logs. Solo expone la programación y los nombres de las etiquetas. No se entregan tokens ARM ni secretos al usuario.

Las respuestas son privadas y sin caché. Las escrituras registran el ID de objeto del administrador, la frecuencia y la activación del timer o el número de etiquetas seleccionadas, sin credenciales. El rol de gestión de la Function no concede permisos de configuración sobre PostgreSQL o Storage; el rol adicional de sus gráficas permite únicamente leer métricas en los dos recursos indicados.

La [definición de un rol personalizado pertenece a la suscripción](https://learn.microsoft.com/en-us/azure/role-based-access-control/custom-roles), aunque solo admita asignaciones en este grupo. Al destruir el grupo se eliminan sus recursos y asignaciones; la definición puede permanecer como metadato sin coste. Después de destruir el entorno, puedes eliminarla con `az role definition delete --subscription '<SUBSCRIPTION_ID>' --name 'Goliat Function Administrator (rg-goliat-dev)'`. Azure rechaza la eliminación si quedan asignaciones que la utilicen.

La definición del rol de métricas también puede permanecer después de destruir el grupo. Para retirarla cuando ya no tenga asignaciones, utiliza `az role definition delete --subscription '<SUBSCRIPTION_ID>' --name 'Goliat Data Metrics Reader (rg-goliat-dev)'`.

## Invocar la Function fuera del dashboard

El endpoint HTTP tiene una URL pública, con autorización en el código. `functions/src/http/authorize.mjs` verifica firma, caducidad, tenant, audiencia, cliente permitido y rol del access token de Entra. La configuración de este entorno solo permite el ID de cliente de la identidad administrada de la web, con `Inventory.Generate`. Tener la URL, iniciar sesión en Azure o presentar una Function key no sustituye ese token. La identidad web no tiene `Inventory.Publish` para publicar documentos arbitrarios. El nivel HTTP `anonymous` de Azure Functions permite llegar al manejador que verifica Entra; no evita esa comprobación.

La autorización depende de la identidad y sus permisos, no de que la petición proceda de una pestaña del dashboard. Otro proceso solo podría usar esta API con una identidad explícitamente permitida y con el rol requerido. Para habilitar una automatización adicional se necesitaría autorizar su cliente y asignarle el permiso de la API; no se ha ampliado la lista de clientes de este entorno. [Roles de aplicación y permisos para identidades administradas](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps).

El timer y el worker de la cola son disparadores internos y funcionan sin la web. La programación activa genera y publica el inventario en Storage. Administradores de Azure con los permisos y credenciales de administración correspondientes pueden ejecutar manualmente un disparador o cambiar su configuración; la restricción HTTP no elimina el control administrativo de Azure. [Timer y ejecución manual](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer).
