# Azure Functions de Goliat - Cloud Inventory

Proyecto independiente en Node.js y Azure Functions v4. Recoge recursos de Azure, construye el JSON completo que consume Goliat y lo publica en `cloud-inventory/azure/latest.json`. No necesita PostgreSQL ni importa código de Next.js en producción.

## Desplegar con un comando

Necesitas Node.js 22.12 o superior, npm, Azure CLI y Bicep. No necesitas Terraform ni Azure Functions Core Tools para desplegar. Los scripts funcionan en Windows PowerShell 5.1 y PowerShell 7, desde la raíz del repositorio.

Primero inicia sesión y completa MFA:

```powershell
$goliatAz = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
& $goliatAz login --tenant '<TENANT_ID>' --use-device-code
& $goliatAz account list --output table
& $goliatAz bicep install
$subscriptionId = '<SUBSCRIPTION_ID>'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

Valida el proyecto sin crear recursos y luego despliega:

```powershell
.\functions\deploy.ps1 -ValidateOnly
.\functions\deploy.ps1 -SubscriptionId $subscriptionId -GrantReader -RunAfterDeploy
```

El segundo comando instala las dependencias fijadas, comprueba sintaxis y tests, empaqueta el código, ejecuta `iac/deploy.ps1`, concede lectura al productor y despliega el ZIP con compilación remota. `-RunAfterDeploy` solicita la primera generación. La respuesta confirma que se ha solicitado; el worker publica el fichero cuando termina. Los permisos RBAC pueden tardar en propagarse: si falla esa primera ejecución, corrige los permisos y vuelve a solicitarla.

`-GrantReader` concede **Reader en la suscripción completa que se va a inventariar**, no solo en el grupo nuevo. Es necesario para leer sus recursos existentes. Requiere permisos para asignar roles; puedes omitirlo si esas asignaciones ya están hechas. `Owner`, o `Contributor` más un rol de administración RBAC con el ámbito adecuado, permiten crear los recursos y asignaciones.

La configuración inicial usa Flex Consumption con 512 MB, ninguna instancia permanente, Storage Standard LRS y generación diaria a las **02:00 UTC**. No añade Application Insights, una base de datos ni la web. Para inventarios grandes puedes necesitar más memoria. El coste depende de ejecución, almacenamiento y operaciones; consulta [los detalles de infraestructura y coste](../iac/README.md).

El ZIP incluye `host.json`, los manifiestos npm y `src/`. Excluye settings locales, credenciales, tests y `node_modules`. Azure instala las dependencias durante el despliegue. [Despliegue de Flex Consumption](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to).

## Ejecutar otra vez y consultar el resultado

```powershell
.\functions\run.ps1 -SubscriptionId $subscriptionId
$o = Get-Content .\iac\.azure\goliat-dev.json -Raw | ConvertFrom-Json

# Después de que termine el worker; tu usuario necesita permisos de datos de blobs.
& $goliatAz storage blob show --account-name $o.storageAccountName `
  --container-name cloud-inventory --name azure/latest.json --auth-mode login `
  --query '{etag:properties.etag,lastModified:properties.lastModified,metadata:metadata}'
```

`run.ps1` verifica que el grupo y la Function pertenecen al entorno. Usa la identidad de Azure CLI para obtener la clave administrativa, la conserva en memoria y llama al trigger programado mediante HTTPS. No imprime ni guarda la clave. Es un comando de administración; para usuarios del producto utiliza la API Entra descrita más abajo. [Ejecución manual de triggers no HTTP](https://learn.microsoft.com/en-us/azure/azure-functions/functions-manually-run-non-http).

Los logs del worker muestran `inventory.published` o `inventory.generation.failed`, con el ID de operación. Los estados se guardan en `function-state/_operations/<operationId>.json`; la política de Storage los elimina después de 30 días desde su última modificación. Los archivos de inventario y el bloqueo no se incluyen en esa limpieza.

Para otro entorno, ámbito o configuración:

```powershell
.\functions\deploy.ps1 -SubscriptionId $subscriptionId -Name goliat-test `
  -InventorySubscriptionIds @($subscriptionId, '<OTRA_SUBSCRIPCION_DEL_MISMO_TENANT>') `
  -InventoryTagKeys @('Environment', 'Owner') -GrantReader -RunAfterDeploy

# Desactivar la programación; ejecutar manualmente cuando se necesite.
.\functions\deploy.ps1 -SubscriptionId $subscriptionId -DisableInventoryTimer

# Aumentar memoria cuando el tamaño del inventario lo requiera.
.\functions\deploy.ps1 -SubscriptionId $subscriptionId -InstanceMemoryMB 2048
```

Al volver a desplegar, repite las opciones de ámbito, etiquetas, API y timer que quieras conservar. La plantilla declara todos los settings y aplica los valores predeterminados de las opciones omitidas. Las salidas quedan en `iac/.azure/<Name>.json`; el ZIP en `functions/.azure/function.zip`. Ambos directorios se ignoran en Git.

Para desplegar también web y PostgreSQL, utiliza [iac/deploy-project.ps1](../iac/PROJECT.md). Ese script invoca el despliegue de la Function con `-CodeOnly`, que publica código en la infraestructura existente sin volver a aplicar sus settings. No uses `-CodeOnly` para cambiar configuración de la API o del ámbito: edita la configuración privada del proyecto y vuelve a desplegar su plantilla.

## Lógica y fichero generado

El timer y el POST de generación guardan una operación y envían un mensaje a Storage Queue. El worker:

1. Adquiere una lease compartida, renovable, en `function-state/_control/inventory.lock`.
2. Lee las suscripciones configuradas y consulta Azure Resource Graph con paginación.
3. Completa desde ARM los pools de AKS, el estado de las VM, redes/subredes, NSG y reglas, conexiones de private endpoints, runbooks y webhooks de Automation y webhooks de Container Registry.
4. Construye 69 informes de entrada, totales, agrupaciones y columnas de etiquetas. Las cuatro vistas derivadas se calculan en el backend: el resultado normalizado tiene 73 vistas.
5. Valida contrato, ámbito, recuentos por tipo, cobertura, agrupaciones de etiquetas, IDs y tamaño. Publica el documento completo con condición ETag y confirma el estado de operación.

El formato es JSON UTF-8: `schemaVersion: 2`, `provider: "azure"`, `generatedAt` ISO UTC y `snapshot` con `catalog`, `tagKeys`, `reports`, `totals` y `tags`. Las filas de entrada son objetos. El contrato y las expansiones se detallan en [docs/azure-function.md](../docs/azure-function.md); [contract.json](src/inventory/contract.json) fija los headers del productor. [La prueba de integración](../tests/function-contract.test.mjs) usa el normalizador real del dashboard.

Las consultas trabajan sobre recursos de administración; no descargan contenido de blobs, secretos de Key Vault, claves de cuentas ni cadenas de conexión. Solo se publican los campos seleccionados del contrato. Resource Graph puede tener retraso de indexación y omitir propiedades. Un campo no disponible queda vacío; una consulta fallida aborta la generación y conserva el inventario anterior. Reader no permite ver recursos fuera del ámbito asignado. [Cobertura y funcionamiento de Resource Graph](https://learn.microsoft.com/en-us/azure/governance/resource-graph/overview).

Cada ejecución del worker tiene un límite de 14 minutos, dentro del timeout de host de 15 minutos. La cola reintenta hasta cinco entregas; un mensaje agotado pasa a poison y marca la operación como fallida. Una entrega repetida de una operación completada conserva su resultado. Los POST y el timer comparten la operación mientras esté activa, coordinados mediante una lease de solicitudes independiente de la publicación. Al terminar, el siguiente POST crea otra operación. No se implementa `Idempotency-Key` ni un límite de solicitudes por usuario.

## POST autenticado con Microsoft Entra ID

Se incluyen estos endpoints:

| Método y ruta                                 | Uso                                                        | Permiso                  |
| --------------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| `POST /api/inventory/generate`                | Cuerpo `{}`; devuelve `202`, `operationId` y `statusPath`  | Rol `Inventory.Generate` |
| `GET /api/inventory/operations/{operationId}` | Consulta estado, ETag y recuento                           | Rol `Inventory.Generate` |
| `POST /api/inventory/publish`                 | Valida y sustituye el JSON completo; devuelve `200` y ETag | Rol `Inventory.Publish`  |

Para activarlos, crea una aplicación de API de Entra ID en el tenant de la Function:

El despliegue completo `iac/deploy-project.ps1` ya prepara automáticamente una API para llamadas de servicio desde la web, concede `Inventory.Generate` a su identidad administrada y configura «Actualizar». Para repetir únicamente esa configuración en un proyecto existente: `.\iac\configure-refresh.ps1`. No se concede publicación HTTP ni se configuran scopes delegados para usuarios. Los pasos siguientes son para configurar una API personalizada con esos permisos adicionales.

1. Configura `api.requestedAccessTokenVersion = 2` en su manifiesto. La audiencia esperada es el **Application (client) ID de la API**, no el ID del cliente que llama.
2. Expón los scopes delegados `Inventory.Refresh` y `Inventory.Publish` bajo `api://<API_CLIENT_ID>`.
3. Crea los app roles `Inventory.Generate` e `Inventory.Publish`, permitidos para `Users/Groups` y `Applications`. Asigna únicamente los roles necesarios a usuarios o servicios mediante la aplicación empresarial.
4. Concede al cliente los permisos correspondientes y el consentimiento requerido. Para usuarios se exige **scope delegado y rol**; para servicios se exige el rol de aplicación.
5. Para llamadas de servicio, añade el claim opcional `idtyp` a los access tokens de la API. Solo se admiten tokens de aplicación con `idtyp: app` y sin `scp`.
6. Despliega indicando la API y los clientes autorizados:

```powershell
.\functions\deploy.ps1 -SubscriptionId $subscriptionId `
  -FunctionApiClientId '<API_CLIENT_ID>' -AllowedClientIds @('<CLIENT_ID_QUE_LLAMA>')
```

El cliente obtiene un access token para esa API mediante MSAL o su flujo OAuth. Para un usuario debe solicitar `api://<API_CLIENT_ID>/Inventory.Refresh` o `Inventory.Publish`; para un servicio, `api://<API_CLIENT_ID>/.default`. Enviar un ID token, un token de Graph, una cookie o un email no sirve. [Versión de access tokens](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens), [claim `idtyp`](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference).

Ejemplo con un access token ya adquirido por el cliente autorizado, conservado en `$accessToken`:

```powershell
$o = Get-Content .\iac\.azure\goliat-dev.json -Raw | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $accessToken" }
$operation = Invoke-RestMethod -Method Post -Uri "$($o.functionUrl)/api/inventory/generate" `
  -Headers $headers -ContentType 'application/json' -Body '{}'
Invoke-RestMethod -Uri "$($o.functionUrl)$($operation.statusPath)" -Headers $headers
```

Los estados son `queued`, `running`, `retrying`, `succeeded` y `failed`. `GET /api/inventory/operations/current` devuelve la última operación o `{ "status": "idle" }` si aún no hay una, con los mismos permisos. Cualquier llamador autorizado para generar puede consultar el estado de una operación de este inventario compartido. El GET no devuelve la identidad del solicitante.

Para publicar un archivo, usa un token con permiso `Inventory.Publish` y una condición ETag:

```powershell
# Primera publicación; fallará si ya existe latest.json.
$publishHeaders = @{ Authorization = "Bearer $publishAccessToken"; 'If-None-Match' = '*' }
Invoke-RestMethod -Method Post -Uri "$($o.functionUrl)/api/inventory/publish" `
  -Headers $publishHeaders -ContentType 'application/json; charset=utf-8' -InFile '.\inventario.json'

# Para sustituirlo, usa If-Match con el ETag actual, conservando sus comillas.
# No envíes ambas condiciones a la vez.
```

La subida HTTP admite hasta 8 MiB; la recogida programada admite hasta 64 MiB. Se exige el catálogo completo del ámbito configurado. Se rechazan documentos inválidos, destinos o suscripciones aportados como opciones, generaciones anteriores a la activa y conflictos de ETag. No se escriben snapshots parciales.

Los handlers verifican firma RS256 con las claves de Entra, emisor, tenant, audiencia, caducidad, cliente, tipo de token, scope y rol **antes de leer el cuerpo**. `authLevel: 'anonymous'` elimina la obligación de una Function key; la autorización está implementada en el código y no permite solicitudes anónimas. Sin configurar la API, HTTP devuelve `503`; timer y worker pueden seguir funcionando. Esta plantilla no activa App Service Authentication ni CORS para llamadas desde el navegador. [Validación de claims](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

La Function escribe con su identidad administrada. El usuario autenticado no necesita permisos directos de escritura en Storage. El botón «Actualizar» solicita una generación mediante el backend, espera la publicación confirmada, importa el blob a PostgreSQL y recarga las vistas, según [la guía de integración](../docs/azure-function.md#6-integración-con-el-dashboard).

## Desarrollo local y pruebas

Para probar la recogida real sin levantar el host de Functions:

```powershell
Copy-Item .\functions\local.settings.example.json .\functions\local.settings.json
# Edita tenant, suscripciones y endpoint de Storage; utiliza AZURE_AUTH_MODE=default.
npm --prefix functions ci
npm --prefix functions run collect -- --output .\azure-inventory.local.json
npm --prefix functions run validate -- .\azure-inventory.local.json
```

`collect` utiliza las credenciales locales de Azure, recoge datos reales y guarda el archivo local; no publica en Storage. Del `.env` de la raíz solo lee `INVENTORY_TAG_KEYS`, sin importar las credenciales ni otros ajustes del dashboard. La prioridad de esta variable es: entorno del terminal, `.env` y `local.settings.json`. Para detectar todas las etiquetas, deja su valor vacío. Los archivos `local.settings.json` y `azure-inventory.local.json` de esta carpeta se ignoran en Git.

El host local de Functions usa `INVENTORY_TAG_KEYS` de `local.settings.json`. En Azure, el panel **Administración → Etiquetas a monitorizar** guarda la selección en los ajustes de la Function. Después de guardar, actualiza el inventario para regenerar e importar las columnas. La opción automática detecta todas las etiquetas; una lista explícita limita las columnas a esos nombres y conserva todas las etiquetas originales en `tags_json`. El despliegue IaC configura el mismo ajuste desde `inventory.tagKeys`; mantenlo alineado si vuelves a desplegar la infraestructura.

Para ejecutar triggers en local, instala Azure Functions Core Tools v4 y arranca Azurite, por ejemplo con la extensión de VS Code. Ejecuta `npm --prefix functions start`. La cola y el host usan `AzureWebJobsStorage=UseDevelopmentStorage=true`; el inventario y los estados siguen usando la cuenta Azure configurada. Tu identidad local necesita lectura de recursos y escritura de blobs en esa cuenta. La validación JWT sigue activa en HTTP. Para disparar el timer localmente, incluso desactivado como tarea programada, usa el endpoint administrativo del host:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:7071/admin/functions/inventoryTimer' `
  -ContentType 'application/json' -Body '{"input":""}'
```

La configuración de ejemplo desactiva el timer para evitar ejecuciones locales inesperadas. [Desarrollo local con Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-develop-local).

Pruebas sin cuenta Azure:

```powershell
npm --prefix functions run check
npm --prefix functions test
node --test tests/function-contract.test.mjs
```

Se comprueban paginación, errores ARM, preservación de `false`/`0`, 69 informes y 73 vistas, ámbitos, tokens firmados y permisos, publicación condicional y recuperación de operaciones. El despliegue real requiere además probar conectividad, permisos, cuota Flex y registro de triggers en tu suscripción.

## Destruir el entorno

Si usaste `-GrantReader`, elimina sus asignaciones fuera del grupo **antes** de borrar la identidad:

```powershell
$o = Get-Content .\iac\.azure\goliat-dev.json -Raw | ConvertFrom-Json
foreach ($inventoryId in $o.inventorySubscriptionIds) {
  & $goliatAz role assignment delete --subscription $inventoryId `
    --assignee $o.identityPrincipalId --role Reader --scope "/subscriptions/$inventoryId"
}
.\iac\destroy.ps1 -SubscriptionId $subscriptionId -WhatIf
.\iac\destroy.ps1 -SubscriptionId $subscriptionId
```

Usa el mismo `-Name` si elegiste otro entorno. El borrado elimina el grupo entero y todos los datos de su Storage. [Detalles y comprobaciones de borrado](../iac/README.md#destruir).
