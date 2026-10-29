# Comandos sencillos de Goliat

Para habilitar la gestión de miembros en un despliegue tenant: `.\goliat.ps1 members`. Prepara las tablas y el permiso de lectura de usuarios para la identidad web. Requiere consentimiento de un administrador autorizado de Entra; consulta [Miembros y permisos](../docs/members.md).

Desde la raíz del repositorio, utiliza `goliat.ps1` con PowerShell 5.1 o superior. No necesitas instalar Make. El script reutiliza los comandos de `iac/`, lee `AZURE_SUBSCRIPTION_ID` de `iac/.env` y usa el entorno `goliat-dev` por defecto.

```powershell
.\goliat.ps1 help
```

Ejecutarlo sin argumentos muestra la misma ayuda. Consultar la ayuda no necesita configuración, Azure CLI ni iniciar sesión.

## Preparación

Para operar sobre Azure necesitas Azure CLI, Bicep y una sesión con permisos en la suscripción y en Entra ID. El despliegue completo y `build` requieren Docker Desktop en modo Linux, Node.js 22.12 o superior y npm. `validate` solo necesita Azure CLI con Bicep instalado; no necesita login ni Docker.

```powershell
# Solo si PowerShell bloquea los scripts; afecta a esta sesión.
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

# Conserva iac/.env si ya está configurado.
if (-not (Test-Path .\iac\.env)) {
    Copy-Item .\iac\.env.example .\iac\.env
}
# Edita AZURE_SUBSCRIPTION_ID en iac/.env.

az login --tenant '<TENANT_ID>' --use-device-code
az bicep install

# Genera la configuración privada local; no crea recursos en Azure.
.\goliat.ps1 init
.\goliat.ps1 validate
```

Si `az` no está en `PATH`, el script busca también su instalación habitual en Windows. Puedes indicar otra ruta con `-AzPath 'C:\ruta\az.cmd'`. Para iniciar sesión en ese caso, utiliza `& 'C:\ruta\az.cmd' login --tenant '<TENANT_ID>' --use-device-code`.

Las credenciales se guardan en `iac/.azure/<nombre>.project.local.json`, excluido de Git. No compartas ese archivo. `init` conserva las credenciales y la autenticación existentes; puedes elegir el modo con `init -AuthMode demo` o `init -AuthMode tenant -TenantId '<TENANT_ID>'`.

## Comandos

| Comando                     | Qué hace                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `.\goliat.ps1 help`         | Muestra la ayuda sin ejecutar otras acciones.                                              |
| `.\goliat.ps1 init`         | Prepara la configuración privada local.                                                    |
| `.\goliat.ps1 validate`     | Compila la plantilla Bicep sin acceder a la suscripción.                                   |
| `.\goliat.ps1 build`        | Compila la web en Docker Linux y guarda `iac/.azure/<nombre>.web.zip`; no despliega.       |
| `.\goliat.ps1 plan`         | Consulta los cambios previstos de infraestructura, sin aplicarlos en Azure.                |
| `.\goliat.ps1 deploy`       | Compila, crea o actualiza infraestructura, inicializa PostgreSQL y publica web y Function. |
| `.\goliat.ps1 stop`         | Detiene web, Function y PostgreSQL.                                                        |
| `.\goliat.ps1 start`        | Inicia PostgreSQL, Function y web.                                                         |
| `.\goliat.ps1 destroy-plan` | Comprueba el grupo y muestra el borrado que se ejecutaría.                                 |
| `.\goliat.ps1 destroy`      | Elimina el grupo completo, incluidos PostgreSQL, Storage y sus datos.                      |

`plan` puede crear el archivo privado local si todavía no existe. No modifica aplicaciones Entra ni aplica cambios en Azure, y muestra IDs de recursos para evitar imprimir secretos. No comprueba la compilación de la web; utiliza `build` para eso.

## Desplegar o actualizar

```powershell
# Revisa los cambios y despliega conservando el modo de login guardado.
.\goliat.ps1 plan
.\goliat.ps1 deploy

# Primera instalación: conceder lectura y solicitar una generación de inventario.
.\goliat.ps1 deploy -GrantReader -RunAfterDeploy
```

`-GrantReader` asigna Reader a la identidad de la Function en las suscripciones a inventariar. `-RunAfterDeploy` solicita una generación asíncrona; no espera a que termine ni importa el JSON a PostgreSQL. Después, «Actualizar» en el dashboard genera e importa el inventario.

Para elegir explícitamente la autenticación, utiliza el mismo modo en el plan y el despliegue:

```powershell
# Login con Microsoft Entra ID.
.\goliat.ps1 plan -AuthMode tenant -TenantId '<TENANT_ID>'
.\goliat.ps1 deploy -AuthMode tenant -TenantId '<TENANT_ID>'

# Alternativa: login demo con las credenciales del archivo privado.
.\goliat.ps1 plan -AuthMode demo
.\goliat.ps1 deploy -AuthMode demo
```

El despliegue tenant prepara el registro Entra y su callback. Incluso con login demo, la comunicación web → Function utiliza una API Entra autenticada. Los permisos de Azure y de registro de aplicaciones son distintos; consulta la [guía completa del proyecto](PROJECT.md#crear-y-desplegar).

## Detener e iniciar

```powershell
.\goliat.ps1 stop
.\goliat.ps1 start
```

Detener conserva los datos. Storage, almacenamiento y copias de PostgreSQL siguen teniendo coste; un plan web de pago también mantiene su coste. Azure vuelve a iniciar PostgreSQL tras siete días detenido. Para eliminar los recursos y sus costes asociados, utiliza `destroy`.

## Destruir el entorno

```powershell
# Primero comprueba la suscripción y el grupo, sin borrar.
.\goliat.ps1 destroy-plan

# Equivalente al comando anterior.
.\goliat.ps1 destroy -WhatIf

# Borrado real: espera a que Azure termine de eliminar el grupo.
.\goliat.ps1 destroy
```

**`destroy` borra `rg-goliat-dev` y todos sus recursos y datos.** No solicita confirmación adicional por defecto. Utiliza `-Confirm` si quieres una confirmación interactiva. El script verifica la suscripción y las etiquetas de propiedad de Goliat; rechaza grupos ajenos y permite repetir el borrado si el grupo ya no existe.

El borrado del grupo conserva los archivos locales, los registros de aplicaciones Entra y las definiciones de roles personalizadas. Las asignaciones Reader fuera del grupo tienen un alcance distinto: si las creaste, revócalas antes de destruir la identidad siguiendo el [procedimiento de limpieza](PROJECT.md#detener-iniciar-o-destruir). `destroy-plan` previsualiza el borrado del grupo, sin revocar estos permisos.

## Opciones por comando

| Comandos                                                     | Opciones                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Todos los comandos salvo `help`                              | `-Name <nombre>` para seleccionar otro entorno.                                                                                          |
| `plan`, `deploy`, `start`, `stop`, `destroy-plan`, `destroy` | `-SubscriptionId <ID>` para sustituir la suscripción de `iac/.env`; `-AzPath <ruta>`.                                                    |
| `init`                                                       | `-AuthMode demo\|tenant`, `-TenantId <ID>`.                                                                                              |
| `validate`                                                   | `-AzPath`, `-ConfigPath`, `-AuthMode`, `-TenantId`; las opciones de configuración solo se validan si indicas `-ConfigPath`.              |
| `plan`, `deploy`                                             | `-AuthMode`, `-TenantId`, `-Location <región>` (por defecto `westeurope`), `-WebSku F1\|B1` (por defecto `F1`), `-ConfigPath <archivo>`. |
| `deploy`                                                     | `-GrantReader`, `-RunAfterDeploy`, `-RotateEntraSecret`, `-InfrastructureOnly`.                                                          |

El script rechaza opciones que no correspondan al comando. `-WebSku B1` elige un plan web de pago; `-InfrastructureOnly` omite la inicialización de PostgreSQL y la publicación del código. `-RotateEntraSecret` renueva el secreto de la aplicación de login tenant. Los detalles están en [PROJECT.md](PROJECT.md).

```powershell
# Otro entorno: utiliza siempre el mismo nombre al operarlo.
.\goliat.ps1 plan -Name goliat-test -SubscriptionId '<SUBSCRIPTION_ID>'
.\goliat.ps1 destroy-plan -Name goliat-test -SubscriptionId '<SUBSCRIPTION_ID>'

# Muestra la acción sin ejecutar el script de inicio, parada o despliegue.
.\goliat.ps1 stop -WhatIf
```

Para `deploy`, `start` y `stop`, `-WhatIf` muestra el destino y omite la ejecución; no consulta el estado de Azure. Para ver el detalle de infraestructura utiliza `plan`. En `destroy -WhatIf` sí se consulta Azure para comprobar el grupo, pero no se borra. El script también respeta un `$WhatIfPreference = $true` heredado de la sesión.

Puedes invocar `goliat.ps1` por su ruta absoluta desde otra carpeta: busca `iac/.env` junto al proyecto. `-ConfigPath` y un `-AzPath` relativo se resuelven desde tu directorio actual.
