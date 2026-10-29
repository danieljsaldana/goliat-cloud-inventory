# Infraestructura Azure de Goliat

Para usar comandos cortos desde la raíz, consulta [goliat.ps1 y su guía de comandos](COMMANDS.md): despliegue completo, inicio, parada y borrado con la suscripción de `iac/.env`.

Bicep y Azure CLI, con scripts compatibles con Windows PowerShell 5.1 y PowerShell 7. No requiere Terraform, archivos de estado ni credenciales versionadas.

Para **crear y desplegar el proyecto completo**, incluida la web en App Service F1 y PostgreSQL B1ms en Azure, usa [deploy-project.ps1 y su guía](PROJECT.md). El alojamiento web es gratuito por defecto; PostgreSQL, Storage y consumo de la Function tienen su propia facturación. Este documento describe el despliegue básico de Function y Storage.

## Qué crea

Todo queda dentro de un grupo exclusivo para este entorno, `rg-goliat-dev` por defecto:

| Recurso                        | Configuración inicial                                                            |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Resource Group                 | West Europe, con etiquetas de propiedad del entorno                              |
| Function App                   | Linux, Node.js 22, runtime Functions 4, Flex Consumption                         |
| Plan de Functions              | 512 MB, cero instancias Always Ready, máximo una instancia por grupo de escalado |
| Storage Account                | StorageV2, Standard LRS, Hot, TLS y autenticación Entra ID                       |
| Contenedor `cloud-inventory`   | Privado; el productor escribirá `azure/latest.json`                              |
| Contenedor `function-releases` | Privado; paquetes de despliegue de la Function                                   |
| Contenedor `function-state`    | Privado; bloqueo compartido y estados de operación con limpieza tras 30 días     |
| Identidad administrada         | Sin secretos, con permisos para el host y la publicación en Storage              |

La misma cuenta sirve para el host, los paquetes y el inventario. Los nombres de Function y Storage llevan un sufijo estable por grupo/suscripción para evitar colisiones globales. Repetir el despliegue actualiza los mismos recursos sin vaciar los blobs.

`iac/deploy.ps1` prepara la infraestructura sin publicar código. El productor está en [functions/](../functions/README.md): su script `deploy.ps1` crea esta infraestructura y después despliega timer, cola y endpoints protegidos mediante validación JWT de Entra. La API HTTP requiere una aplicación de Entra y permisos del cliente; la plantilla no crea esas aplicaciones. [deploy-project.ps1](PROJECT.md) añade la web y PostgreSQL y publica ambos proyectos.

## Coste mínimo para empezar

Flex Consumption escala a cero y, sin Always Ready, cobra por ejecución. 512 MB es el tamaño mínimo; la plantilla permite cuatro peticiones HTTP simultáneas para solicitar una generación y consultar su estado. Las generaciones se coordinan con un lease de Storage. Microsoft recomienda Flex para aplicaciones serverless nuevas. [Plan Flex Consumption](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan).

El despliegue básico no crea Application Insights, Log Analytics, redes privadas, NAT, planes Premium ni base de datos. El despliegue completo añade PostgreSQL, con coste propio. LRS evita la replicación entre regiones; mantener los contenedores en una cuenta reduce recursos. No se activa versionado ni retención de blobs eliminados: antes de destruir, descarga los ficheros que quieras conservar.

La franquicia mensual publicada para Flex on demand es de **250.000 ejecuciones y 100.000 GB-s por suscripción** en las suscripciones de consumo de pago que cumplan las condiciones. Como ejemplo, 30 ejecuciones de cinco minutos con 512 MB sumarían aproximadamente 4.500 GB-s. No es una promesa de factura cero: Storage, sus operaciones y tráfico se cobran aparte, y otras Functions comparten esa franquicia. [Precios oficiales](https://azure.microsoft.com/en-us/pricing/details/functions/).

Consumo clásico tiene una franquicia mayor, pero Microsoft lo considera un plan heredado y recomienda Flex para proyectos nuevos. El coste real depende de duración, volumen de datos y región; 512 MB puede necesitar ampliarse al recopilar inventarios grandes. [Opciones de alojamiento](https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale), [estimación de consumo](https://learn.microsoft.com/en-us/azure/azure-functions/functions-consumption-costs).

El máximo de instancias es un límite de escalado por grupo de funciones, **no un presupuesto ni un tope de facturación**. Evita programación demasiado frecuente y reintentos ilimitados en el productor. Un presupuesto de Azure puede avisarte, pero tampoco detiene automáticamente los cargos.

## Iniciar sesión y elegir suscripción

Desde la raíz del repositorio:

```powershell
$goliatAz = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
& $goliatAz login --tenant '<TENANT_ID>' --use-device-code
& $goliatAz account list --output table
$subscriptionId = '<SUBSCRIPTION_ID>'
& $goliatAz bicep install
```

Completa MFA en el navegador. Usa el **ID de la suscripción**, que es distinto del ID del tenant. Los scripts localizan `az` en PATH o en la instalación estándar de Windows; puedes indicar otra ruta con `-AzPath $goliatAz`.

Necesitas permisos para crear grupos y recursos en la suscripción y asignar roles a la identidad. `Owner`, o `Contributor` más `Role Based Access Control Administrator` con ámbito suficiente, cubren esos pasos; `Contributor` solo no permite asignar roles.

Si tu consola bloquea los `.ps1`, permite scripts locales únicamente en esa sesión:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

No cambia la política permanente. Si una política de tu organización lo impide, usa la vía aprobada por su administrador.

## Validar, previsualizar y crear

```powershell
# Compila Bicep localmente; no necesita iniciar sesión ni crea recursos.
.\iac\deploy.ps1 -ValidateOnly

# Consulta a Azure y muestra el cambio previsto; no registra proveedores ni despliega.
.\iac\deploy.ps1 -SubscriptionId $subscriptionId -Plan

# Crea o actualiza el entorno.
.\iac\deploy.ps1 -SubscriptionId $subscriptionId
```

El script de creación registra los proveedores necesarios si faltan, incluido `Microsoft.App` para Flex. La primera ejecución puede tardar varios minutos. Si `-Plan` falla por un proveedor sin registrar, registra el proveedor indicado antes de repetir la previsualización.

Todas las operaciones cloud reciben explícitamente `--subscription`; el script no cambia tu suscripción predeterminada. Si `rg-goliat-dev` ya existe sin las etiquetas de este entorno, se rechaza el despliegue para no apropiarse de un grupo ajeno. Un fallo de Azure CLI detiene el script y no se anuncia éxito. Si queda un despliegue parcial, puedes repetirlo o destruir su grupo.

Para otro entorno o una Function que necesite más memoria:

```powershell
.\iac\deploy.ps1 -SubscriptionId $subscriptionId -Name goliat-test -Location westeurope
.\iac\deploy.ps1 -SubscriptionId $subscriptionId -InstanceMemoryMB 2048 -NodeVersion 24
```

`-Name` admite entre 3 y 20 caracteres, en minúsculas, con números y guiones. Usa el mismo nombre al actualizar y destruir. `-Location` debe soportar Flex Consumption; puedes consultar regiones con `& $goliatAz functionapp list-flexconsumption-locations --subscription $subscriptionId --output table`. No se puede cambiar la región del grupo existente con este script.

Las salidas quedan en `iac/.azure/<Name>.json`, ignorado por Git. Incluyen endpoints e IDs, sin claves ni tokens:

```powershell
$o = Get-Content .\iac\.azure\goliat-dev.json -Raw | ConvertFrom-Json
$o.functionAppName
$o.storageAccountUrl
$o.identityPrincipalId
```

Las variables de aplicación se gestionan en `resources.bicep`. Añade allí la configuración del colector antes de volver a aplicar la plantilla: Azure reemplaza la colección de settings declarada y puede quitar variables añadidas solo desde el portal o desde otro despliegue. Los permisos RBAC pueden necesitar unos minutos para propagarse. [Configuración mediante IaC](https://learn.microsoft.com/en-us/azure/azure-functions/functions-infrastructure-as-code).

## Conectar el dashboard

La identidad del dashboard debe tener **Storage Blob Data Reader** en el contenedor de inventario. La identidad de la Function dispone de permisos más amplios para el host; no la compartas con la web.

Para leer en desarrollo con tu usuario de Azure CLI:

```powershell
$userId = & $goliatAz ad signed-in-user show --query id --output tsv
& $goliatAz role assignment create --subscription $subscriptionId `
  --assignee-object-id $userId --assignee-principal-type User `
  --role 'Storage Blob Data Reader' --scope $o.inventoryContainerId

# DefaultAzureCredential necesita encontrar az en PATH al arrancar Node.
$env:PATH = "$(Split-Path $goliatAz);$env:PATH"
& $goliatAz account set --subscription $subscriptionId
```

Configura en el `.env` del dashboard el endpoint que devuelve `$o.storageAccountUrl`:

```dotenv
AZURE_AUTH_MODE=default
AZURE_STORAGE_ACCOUNT_URL=https://<storage-creado>.blob.core.windows.net/
AZURE_STORAGE_CONTAINER=cloud-inventory
AZURE_STORAGE_BLOB=azure/latest.json
```

El endpoint no contiene SAS ni claves. Para una web alojada en Azure, configura su propia identidad administrada y `AZURE_AUTH_MODE=managed-identity`. El JSON solo existirá cuando el productor lo publique. Además, la migración SQL inicial del dashboard sigue vacía: hay que implementar su esquema para utilizar la persistencia y `collect:azure`.

## Permisos y código del productor

La identidad administrada ya puede escribir el inventario y acceder al almacenamiento interno. Para consultar recursos, concede `Reader` **solo en las suscripciones que se van a inventariar**; estos permisos fuera del grupo no los crea esta plantilla:

```powershell
$inventorySubscriptionId = $subscriptionId
& $goliatAz role assignment create --subscription $inventorySubscriptionId `
  --assignee-object-id $o.identityPrincipalId --assignee-principal-type ServicePrincipal `
  --role Reader --scope "/subscriptions/$inventorySubscriptionId"
```

Repite el permiso para cada suscripción del ámbito y configura ese ámbito en el productor. Consultas de servicios concretos pueden necesitar permisos adicionales, como explica la [guía de la Function](../docs/azure-function.md). La identidad necesita pertenecer al tenant correspondiente.

Desde la raíz de este repositorio, publica el productor incluido y solicita una primera generación:

```powershell
.\functions\deploy.ps1 -SubscriptionId $subscriptionId -GrantReader -RunAfterDeploy
```

`-GrantReader` hace opcionalmente las asignaciones de lectura mostradas arriba. El productor publica un documento completo en `cloud-inventory/azure/latest.json`. El POST ya valida Entra en el código; para activarlo configura la aplicación API, los clientes y sus roles según [functions/README.md](../functions/README.md#post-autenticado-con-microsoft-entra-id). El login de Azure CLI sirve para administrar el despliegue y no autentica automáticamente al usuario de la API. [Despliegue en Flex](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to).

## Destruir

El comando elimina **todo el grupo**, incluidos Function, plan, identidad, cuenta Storage y todos sus blobs. Mantén este grupo exclusivo para Goliat.

```powershell
# Comprueba el destino; no elimina nada.
.\iac\destroy.ps1 -SubscriptionId $subscriptionId -WhatIf

# Elimina el grupo y espera a que Azure termine.
.\iac\destroy.ps1 -SubscriptionId $subscriptionId

# Para el otro entorno:
.\iac\destroy.ps1 -SubscriptionId $subscriptionId -Name goliat-test
```

Se verifica la suscripción, el ID completo del grupo y sus etiquetas antes de borrar. Si el grupo no existe, el comando termina correctamente; si pertenece a otro entorno, lo rechaza. No hay borrados por prefijo ni búsquedas de recursos en otras suscripciones. Los locks o permisos insuficientes de Azure producen un error.

Si añadiste `Reader` al productor fuera del grupo, revócalo **antes** de destruirlo para no dejar una asignación ligada a una identidad eliminada:

```powershell
& $goliatAz role assignment delete --subscription $inventorySubscriptionId `
  --assignee $o.identityPrincipalId --role Reader --scope "/subscriptions/$inventorySubscriptionId"
```

Las salidas locales y el registro del despliegue a nivel de suscripción pueden permanecer como referencia; no mantienen recursos facturables. Destruir impide nuevos cargos de los recursos eliminados, pero no anula consumo ya realizado.

## Archivos

- `main.bicep`: crea el grupo desde el ámbito de suscripción y ejecuta el módulo.
- `resources.bicep`: Storage, contenedores, identidad, permisos, plan y Function.
- `deploy.ps1`: validación, previsualización, creación y salidas locales.
- `destroy.ps1`: eliminación del grupo con comprobación de propiedad y `-WhatIf`.
- `common.ps1`: resolución de Azure CLI y comprobaciones compartidas.
- `project.bicep`, `web.bicep` y `postgres.bicep`: infraestructura del proyecto completo.
- `deploy-project.ps1` y `package-web.ps1`: creación, compilación Linux y publicación web/Function.
- `init-project.ps1` y `project-config.ps1`: configuración privada y validación.
- `power-project.ps1`: detener e iniciar web, Function y PostgreSQL.
- `administration.bicep` y `configure-administration.ps1`: permisos de gestión sobre la Function y administradores Entra del panel; [configuración y uso](../docs/administration.md).
