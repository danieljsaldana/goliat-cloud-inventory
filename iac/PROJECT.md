# Desplegar Goliat completo con coste reducido

La [guía de comandos sencillos](COMMANDS.md) permite operar este despliegue con `.\goliat.ps1 deploy`, `stop`, `start`, `destroy-plan` y `destroy`, desde la raíz del repositorio.

`deploy-project.ps1` crea el grupo, Storage, Function, alojamiento de la web y **PostgreSQL en Azure**. Después publica el código de la web y de la Function. Estos recursos quedan en el mismo grupo y se eliminan con `destroy.ps1`. Los registros Entra del login y de la API de la Function pertenecen al directorio y se conservan al destruir el grupo.

## Qué se utiliza y cuánto cuesta

| Componente      | Configuración inicial                                                             | Coste                                                              |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Web Next.js     | App Service Linux F1, Node.js 24                                                  | Plan gratuito, sujeto a sus cuotas                                 |
| PostgreSQL      | Flexible Server Burstable B1ms, 32 GB, sin alta disponibilidad, backups de 7 días | Cómputo y almacenamiento de pago                                   |
| Function        | Flex Consumption, 512 MB, sin instancias permanentes                              | Según ejecución y franquicia disponible                            |
| Inventario      | Storage Standard LRS, contenedores privados                                       | Almacenamiento y operaciones                                       |
| Compilación web | Docker en tu equipo; ZIP standalone Linux                                         | No crea un registro de imágenes ni usa compilación remota de Azure |

F1 sirve para empezar con poco uso: tiene **60 minutos de CPU al día**, 1 GB de RAM y 1 GB de almacenamiento, sin SLA. Puede suspender la web al superar cuotas y tiene arranque en frío. No es una garantía de disponibilidad para producción. Si necesitas más capacidad, utiliza `-WebSku B1`, que tiene coste mensual. [Precio de App Service Linux](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/), [cuotas de App Service](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-app-service-limits).

PostgreSQL no escala automáticamente a cero. B1ms es una configuración Burstable pequeña para desarrollo y baja concurrencia, con 32 GB de almacenamiento. La factura depende de región, moneda, consumo y promociones de tu suscripción; **la solución completa no es gratuita**, aunque la web use F1. [Niveles de PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/compute-storage/concepts-compute), [precios oficiales](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/).

No se añaden ACR, máquinas virtuales, Log Analytics, Application Insights, redes privadas, NAT, CDN ni réplicas adicionales. Las [decisiones de coste de Function y Storage](README.md#coste-mínimo-para-empezar) siguen siendo las del despliegue básico.

## Crear y desplegar

Requisitos: Azure CLI, Bicep, Node.js 22.12 o superior, npm y **Docker Desktop funcionando en modo Linux**. El script compila antes de crear recursos. Necesitas permisos de creación y asignación de roles en el ámbito correspondiente.

Desde la raíz del proyecto:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
$goliatAz = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
& $goliatAz login --tenant '<TENANT_ID>' --use-device-code
& $goliatAz account list --output table
& $goliatAz bicep install
Copy-Item .\iac\.env.example .\iac\.env
# Edita AZURE_SUBSCRIPTION_ID en iac/.env. No se versiona.
$subscriptionId = '<SUBSCRIPTION_ID>' # Para detener o destruir explícitamente.

# Compila la plantilla completa; no necesita login, Docker ni crea recursos.
.\iac\deploy-project.ps1 -ValidateOnly

# Previsualiza los recursos. Solo muestra IDs/cambios para no imprimir secretos.
.\iac\deploy-project.ps1 -Plan

# Compila, crea los recursos, publica web y Function y solicita el primer inventario.
.\iac\deploy-project.ps1 -GrantReader -RunAfterDeploy
```

`-GrantReader` concede lectura al productor en las suscripciones que se van a inventariar. Omítelo si ya tiene esa lectura. `-RunAfterDeploy` solicita una generación asíncrona; no espera a que termine ni importa el JSON a PostgreSQL.

El despliegue prepara automáticamente la API Entra de la Function para «Actualizar», también con login demo. La identidad administrada de la web recibe únicamente `Inventory.Generate`. Necesitas permisos de registro y asignación de app roles en el tenant; Owner de Azure por sí solo no los concede. Si falla este paso, el script se detiene sin abrir HTTP ni cambiar el login. Los IDs quedan en `inventory.apiClientId` y `inventory.allowedClientIds` del archivo privado. Para configurar o reparar solo esta conexión sin recompilar ni aplicar PostgreSQL:

```powershell
.\iac\configure-refresh.ps1
```

Para activar **Administración** para un usuario Entra, utiliza su ID de objeto en el tenant del dashboard:

```powershell
.\iac\configure-administration.ps1 -ObjectIds '<ID_OBJETO_USUARIO>'
```

Los administradores quedan en `administration.objectIds` del archivo privado. El despliegue aplica la lista y el rol de gestión de la identidad web, limitado a la Function. La sección solo está disponible en modo tenant; requiere volver a iniciar sesión la primera vez. Permite consultar métricas y guardar o pausar el timer. Para conservar cambios del panel al volver a desplegar la infraestructura, actualiza `inventory.schedule` e `inventory.disableTimer` en ese archivo. [Detalle de acceso, permisos y programación](../docs/administration.md).

Las tarjetas de PostgreSQL y Storage incluyen gráficas de actividad de Azure Monitor. El despliegue configura sus IDs ARM y asigna `Goliat Data Metrics Reader` a la identidad web, con únicamente lectura de métricas sobre estos dos recursos. PostgreSQL externo conserva sus datos SQL sin requerir un servidor Azure. `configure-administration.ps1` aplica esta configuración a un entorno existente sin volver a desplegar la infraestructura del proyecto.

El script localiza `az` y admite `-AzPath` si está en otra ruta. Para otro entorno usa `-Name goliat-test`; para otra región, `-Location`. Repite ese nombre y región al actualizar. `-WebSku B1` cambia a un plan web de pago; no hay cambios automáticos a un plan superior si F1 se queda corto.

La suscripción se lee de `iac/.env`; `-SubscriptionId` permite sobrescribirla. `-InfrastructureOnly` crea los recursos y guarda sus salidas sin compilar, inicializar ni publicar código. `-ValidateOnly` funciona sin suscripción ni sesión Azure.

La web se compila con el `Dockerfile` existente y se empaqueta desde Linux, resolviendo los enlaces simbólicos de Next.js dentro del artefacto. El ZIP contiene servidor standalone, dependencias de Linux, `public`, `.next/static` y los archivos SQL existentes. No incluye `.env`, configuración local ni las carpetas `iac/` y `functions/`. Azure recibe ese ZIP ya compilado y arranca `node server.js`, sin volver a instalar npm. [Despliegue ZIP de App Service](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip), [Node.js en App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs).

## Elegir autenticación: demo o tenant

Puedes elegir el login al desplegar sin editar las credenciales:

```powershell
# Usuario y contraseña privados, generados en la primera configuración.
.\iac\deploy-project.ps1 -AuthMode demo

# Login Microsoft del tenant de la suscripción; prepara el registro Entra automáticamente.
.\iac\deploy-project.ps1 -AuthMode tenant

# Un directorio explícito: Azure CLI debe tener seleccionada una cuenta de ese tenant.
.\iac\deploy-project.ps1 -AuthMode tenant -TenantId '<TENANT_ID>'

# Para cambiar el login de una web ya publicada, sin recompilar ni publicar código.
.\iac\deploy-project.ps1 -AuthMode tenant -InfrastructureOnly

# Previsualizar nunca crea registros Entra, secretos ni callbacks.
.\iac\deploy-project.ps1 -AuthMode tenant -Plan
```

`-AuthMode` sobrescribe la elección del archivo privado y la guarda al aplicar el despliegue. Si se omite, se conserva `authentication.mode`: `demo` o `azure-ad` (el nombre interno del modo `tenant`). Ambos modos requieren autenticación; demo no significa acceso público. El cambio de modo invalida el acceso de las sesiones del modo anterior.

También puedes guardar la elección antes de desplegar con `.\iac\init-project.ps1 -AuthMode tenant`; no accede a Azure. Añade `-TenantId` si necesitas fijar el directorio. El `.env` de la raíz controla el desarrollo local; en Azure, IaC configura las variables de App Service a partir del archivo privado del entorno.

En modo tenant, el script comprueba el directorio de Azure CLI y utiliza `authentication.tenantId`, `-TenantId` o, si no se ha indicado ninguno, el tenant de la suscripción. El ID de tenant es distinto del ID de suscripción. Crea una aplicación **Goliat - Cloud Inventory (`Name`)**, de un solo directorio, con permiso delegado Microsoft Graph `User.Read` para el perfil y la foto. Crea también su aplicación empresarial, genera un secreto de un año y guarda los IDs, el valor y su caducidad en el archivo privado. Después del despliegue registra el callback `https://<hostname-real>/api/auth/callback/microsoft-entra-id`, conservando otras URLs existentes. [Registro de aplicaciones mediante Microsoft Graph](https://learn.microsoft.com/en-us/graph/tutorial-applications-basics).

Los despliegues posteriores reutilizan el registro y su secreto. Si el archivo no contiene el ID, el script solo reutiliza una aplicación cuyo nombre y marca de entorno coincidan; rechaza nombres ajenos o duplicados. Para usar un registro creado manualmente, configura `clientId`, `tenantId` y `clientSecret`; debes poder administrar ese registro para comprobar sus permisos y añadir el callback. No cambia a demo si Entra falla.

Necesitas permisos para registrar aplicaciones en Entra o administrar la existente. Ser Owner de la suscripción no concede automáticamente esos permisos del directorio. El script declara `User.Read`, pero no concede consentimiento administrativo ni modifica las políticas de MFA. Si el tenant impide el consentimiento del usuario, un administrador debe aprobarlo. [Permisos de registro](https://learn.microsoft.com/en-us/entra/identity-platform/how-applications-are-added), [permisos y consentimiento](https://learn.microsoft.com/en-us/entra/identity-platform/permissions-consent-overview).

Por defecto, el registro permite el login de usuarios del tenant. Para limitarlo, activa **Asignación necesaria** en la aplicación empresarial y asigna los usuarios autorizados; asignar grupos requiere la licencia Entra correspondiente. El despliegue conserva estas restricciones si ya existen. [Restringir acceso a usuarios](https://learn.microsoft.com/en-us/entra/identity-platform/howto-restrict-your-app-to-a-set-of-users).

El secreto generado se renueva al desplegar si caduca en siete días o menos. Puedes forzarlo con `-AuthMode tenant -RotateEntraSecret`. La renovación añade un secreto y conserva los anteriores; no los revoca. Sin nuevos despliegues no hay renovación programada. Para secretos manuales, indica `clientSecretExpiresAt` en formato ISO 8601 si quieres esta comprobación. [Credenciales y `--append`](https://learn.microsoft.com/en-us/cli/azure/ad/app/credential?view=azure-cli-latest).

El registro de Entra **no está dentro del resource group**: `destroy.ps1` no lo elimina ni revoca sus secretos. Se puede reutilizar al recrear el mismo entorno. Si necesitas eliminarlo definitivamente, hazlo desde Entra comprobando antes que no lo utiliza otra aplicación.

Esta elección solo configura el login de la web. La API de la Function mantiene su registro, scopes y roles independientes, según [su guía](../functions/README.md#post-autenticado-con-microsoft-entra-id).

## Configuración y credenciales

La primera previsualización o despliegue genera `iac/.azure/goliat-dev.project.local.json`, con contraseñas aleatorias y un secreto de sesión. **No los imprime**. Ese archivo se ignora en Git y en Docker; conserva una copia privada para volver a desplegar con las mismas credenciales. `-ValidateOnly` no lo genera.

Puedes prepararlo y editarlo antes:

```powershell
.\iac\init-project.ps1
# Edita iac/.azure/goliat-dev.project.local.json en tu IDE.
.\iac\deploy-project.ps1 -Plan
```

El archivo sigue [project.example.json](project.example.json):

- `database.create`: `true` para crear PostgreSQL e inicializar sus tablas, con la conexión TLS obligatoria.
- `database.location`: vacío utiliza la región del proyecto; permite elegir otra región para PostgreSQL si la oferta o cuota de la suscripción limita B1ms. En el despliegue de desarrollo se utiliza `northeurope`: la suscripción indicada no ofrecía versiones ni cómputo PostgreSQL en West Europe. El resto de recursos permanece en West Europe. Separar regiones puede añadir latencia y tráfico entre regiones.
- `database.username` y `database.password`: usuario inicial del servidor y contraseña; con la configuración inicial, la web utiliza ese usuario. Puedes crear un usuario limitado para la aplicación y separar las credenciales DDL.
- `database.allowedIps`: IPv4 concretas adicionales, por ejemplo para ejecutar el CLI de base de datos desde tu equipo. Por defecto está vacío. El firewall permite las IP de salida actuales y posibles de esta web; no abre el servidor a todas las direcciones ni a todos los clientes de Azure. Las IP permitidas son compartidas por infraestructura de App Service, así que TLS y autenticación siguen siendo necesarios. [Firewall de PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/security/security-firewall-rules), [IP de salida de App Service](https://learn.microsoft.com/en-us/azure/app-service/overview-inbound-outbound-ips).
- `authentication.mode`: `demo` por defecto, con usuario `goliat` y contraseña generada. Consulta los valores en tu archivo privado para iniciar sesión. El acceso público no se activa.
- `authentication.secret`: secreto estable de sesión, de al menos 32 bytes.
- `authentication.clientId`, `clientSecret` y `tenantId`: credenciales del login Entra; `-AuthMode tenant` las prepara automáticamente si faltan. También permite utilizar un registro existente.
- `authentication.clientSecretExpiresAt`: caducidad del secreto generado; se comprueba en cada despliegue tenant para renovarlo antes de caducar.
- `inventory`: suscripciones, etiquetas, API Entra de la Function y programación. Si `subscriptionIds` está vacío, recoge la suscripción del despliegue. La autenticación de la API de la Function se configura según [su guía](../functions/README.md#post-autenticado-con-microsoft-entra-id); es independiente del login de la web.

Para un PostgreSQL existente, cambia `database.create` a `false` y rellena `host`, `port`, nombre, usuario y contraseña. Debe ser accesible desde Azure, estar inicializado con `db:init` y usar un certificado TLS válido. El script comprueba su esquema antes de publicar; no crea, modifica, detiene ni destruye ese servidor externo. Puedes ver las IP de salida de la web en las salidas del despliegue para autorizarlas en su firewall.

`-ConfigPath` permite usar otro archivo privado. Guárdalo fuera del repositorio o con extensión `.local.json`, también excluida de Git y Docker. Los parámetros con secretos se declaran `@secure()` y el archivo temporal usado para enviarlos a Azure se borra al terminar, incluso ante errores.

Las salidas sin secretos se guardan en `iac/.azure/goliat-dev.project.json`. También se escribe `goliat-dev.json` para los scripts de la Function; volver a desplegar solo el productor no borra la copia de salidas del proyecto:

```powershell
$o = Get-Content .\iac\.azure\goliat-dev.project.json -Raw | ConvertFrom-Json
$o.webUrl
$o.functionUrl
$o.databaseHost
```

La web tiene su propia identidad administrada con `Storage Blob Data Reader` solo en el contenedor del inventario. No comparte la identidad con permisos de escritura de la Function.

## Base de datos inicial

El proyecto empieza sin datos ni historial anterior. `server/migrations/001_initial.sql` continúa vacío. Las tablas nuevas se definen en `server/schema/initial.sql`; el comando `db:init` crea únicamente ese esquema en una base vacía. Guarda su versión y SHA-256 en `inventory_schema`, permite repetir la inicialización y rechaza bases con tablas ajenas o un esquema inicial modificado.

El despliegue completo ejecuta `initialize-project.ps1` antes de publicar código. Autoriza temporalmente **solo la IPv4 pública de este equipo**, conecta con TLS verificado e inicializa PostgreSQL. Retira su regla de firewall al finalizar, incluso si falla. La web nunca ejecuta DDL durante el arranque o una petición. Puedes repetir este paso por separado:

```powershell
.\iac\initialize-project.ps1
```

`/api/health/` comprueba que el proceso responde y `/api/ready/` devuelve `200` cuando la conexión y el esquema están preparados. «Actualizar» solicita generación a la Function, consulta su estado y, después de publicar `azure/latest.json`, importa el ETag confirmado a PostgreSQL y recarga el dashboard. [Contrato y base del dashboard](../docs/backend.md).

## Detener, iniciar o destruir

```powershell
.\iac\power-project.ps1 -SubscriptionId $subscriptionId -Action Stop
.\iac\power-project.ps1 -SubscriptionId $subscriptionId -Action Start
```

Estos comandos actúan solo sobre los recursos del entorno: web, Function y PostgreSQL creado por la plantilla. Detener PostgreSQL evita el cobro de cómputo, pero **sigue cobrando almacenamiento** y Azure lo reinicia automáticamente después de siete días. Un plan web B1 también sigue facturándose aunque su app esté detenida. [Detener PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/how-to-stop-server).

Para eliminar los recursos, incluidos **todos los datos de PostgreSQL y Storage**:

```powershell
# Si concediste Reader fuera del grupo, revócalo antes de eliminar su identidad.
$o = Get-Content .\iac\.azure\goliat-dev.json -Raw | ConvertFrom-Json
foreach ($inventoryId in $o.inventorySubscriptionIds) {
  & $goliatAz role assignment delete --subscription $inventoryId `
    --assignee $o.identityPrincipalId --role Reader --scope "/subscriptions/$inventoryId"
}
.\iac\destroy.ps1 -SubscriptionId $subscriptionId -WhatIf
.\iac\destroy.ps1 -SubscriptionId $subscriptionId
```

Usa el mismo `-Name` si elegiste otro entorno. La [comprobación de propiedad](README.md#destruir) rechaza grupos ajenos. Detener conserva datos; destruir elimina el grupo completo.

## Verificación local

```powershell
.\iac\deploy-project.ps1 -ValidateOnly
.\iac\package-web.ps1
node --test tests/iac.test.mjs tests/project-iac.test.mjs tests/function-compatibility.test.mjs
```

Se valida Bicep y la compilación Linux, el ZIP y la publicación simulada, y se prueban suscripción explícita, rechazo de grupos ajenos, fallos antes de crear recursos, limpieza de parámetros secretos y operaciones de encendido/apagado. El despliegue real necesita comprobar cuotas F1/B1ms y permisos en tu suscripción; no se garantiza que esas cuotas estén disponibles en todas las regiones.
