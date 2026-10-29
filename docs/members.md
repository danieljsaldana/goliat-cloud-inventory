# Miembros y administradores de Goliat

Las rutas `/es/members/` y `/en/members/` aparecen en la navegación de los administradores. Permiten buscar cuentas por nombre, correo, UPN o ID de objeto, filtrar por rol y conceder o retirar permisos de administrador mediante una confirmación. La tabla incluye las cuentas deshabilitadas para que sus permisos también puedan revisarse; no pueden recibir nuevas concesiones.

La columna **Gestionar permisos** usa un escudo con **+** para conceder el rol, un escudo con **−** para retirarlo y un candado para los roles protegidos. Todos los iconos muestran una explicación al pasar el cursor o recibir foco de teclado, situada encima o a un lado si falta espacio arriba. El candado también muestra su explicación al tocarlo. Los escudos abren la confirmación; mantener el dedo sobre ellos permite consultar la explicación antes de soltar. Las acciones no disponibles siguen siendo enfocables para explicar el motivo, pero no permiten modificar permisos.

Cada fila muestra la foto del usuario disponible en Microsoft Graph. Mientras carga, si no existe o si falla la consulta, se conserva el icono de usuario. Las fotos se solicitan solo para los miembros de la página visible mediante `GET /api/admin/members/{objectId}/photo/`, protegido para administradores y sin caché pública. El servidor usa la identidad administrada; el navegador no recibe tokens de Graph. El permiso `User.Read.All` ya concedido permite [leer estas fotos](https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0); no hace falta conceder otro permiso. La foto de una cuenta personal externa puede no estar publicada en el directorio de este tenant.

## Qué significa tener acceso

La configuración actual de Entra admite cuentas del propio tenant y tiene `appRoleAssignmentRequired=false`. Por eso se consultan **todas las cuentas del tenant**, aunque todavía no hayan iniciado sesión en Goliat. Las cuentas habilitadas pueden autenticarse, sujetas a las políticas de Entra. La lista no sustituye las políticas de acceso condicional, MFA o restricciones de invitados.

Esta modalidad no representa aplicaciones configuradas con asignación individual de usuarios o grupos. El script comprueba esta condición y se detiene si `appRoleAssignmentRequired=true`; nunca abre el acceso ni modifica esa política. Si se cambia esa política posteriormente, deshabilita Miembros (`DASHBOARD_MEMBERS_ENABLED=false`) hasta implementar un listado basado en las asignaciones efectivas.

| Rol de Goliat | Acceso                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Miembro       | Inventario de Azure y arquitectura.                                                      |
| Administrador | Lo anterior, Administración, programación del inventario y gestión de roles en Miembros. |

Estos roles **no son roles de Azure RBAC ni roles de administrador del tenant de Entra**. Goliat no modifica usuarios, contraseñas, grupos, licencias ni asignaciones de roles en el directorio.

## Habilitar la vista en Azure

Con el proyecto desplegado en modo tenant y al menos un administrador inicial en `administration.objectIds`:

```powershell
.\goliat.ps1 members
# Equivalente:
.\iac\configure-members.ps1 -Name goliat-dev

# Si el equipo no tiene conectividad directa a PostgreSQL:
.\goliat.ps1 members -DatabaseFromWeb
```

Este comando:

1. Verifica la suscripción, el tenant, la política de acceso de la aplicación y la identidad de la web.
2. En PostgreSQL creado por `iac/`, prepara las tablas de permisos y auditoría con un acceso de firewall temporal que se retira al terminar.
3. Concede **únicamente `User.Read.All` de aplicación de Microsoft Graph** a la identidad administrada de la web. Es necesario para listar usuarios y leer `accountEnabled`; requiere consentimiento de un administrador de Entra autorizado. Ser propietario de la suscripción no basta.
4. Activa `DASHBOARD_MEMBERS_ENABLED=true` y guarda `administration.membersEnabled=true` en el archivo privado del proyecto, para conservarlo en siguientes despliegues.

`-DatabaseFromWeb` prepara únicamente las tablas de Miembros desde Kudu, autenticado con el token de Entra de Azure CLI. Utiliza la conexión de PostgreSQL de la web sin mostrar sus credenciales y conserva el inventario. Requiere una web ya publicada y permisos de ejecución sobre su servicio de despliegue; no abre el firewall ni habilita autenticación básica. Si App Service ha empaquetado `node_modules` en un archivo TAR, carga temporalmente el cliente PostgreSQL de ese mismo artefacto y retira la copia al terminar.

El comando no publica código: despliega primero una versión que incluya la vista. La primera consulta puede tardar en funcionar mientras se propaga el consentimiento o se renueva el token de la identidad administrada. No se registran tokens ni secretos.

Para PostgreSQL externo, ejecuta `npm run db:init` con sus credenciales autorizadas antes de habilitar la vista. La identidad utilizada en local mediante `AZURE_AUTH_MODE` debe pertenecer al mismo tenant y poder leer usuarios de Graph. El modo demo no dispone de gestión de miembros.

Referencias: [Listar usuarios de Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0) y [asignar un permiso de aplicación a una identidad administrada](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/assign-app-role-managed-identity-powershell).

## Persistencia y autorización

Los administradores iniciales definidos por `DASHBOARD_ADMIN_OBJECT_IDS` siguen siendo la vía de recuperación y se gestionan desde el despliegue. No se pueden retirar desde la vista. Un administrador tampoco puede modificar su propio rol.

Los permisos concedidos desde la web se guardan en `application_administrators`, identificados por **tenant + ID de objeto**, nunca por nombre o correo. Cada cambio real se registra en `application_role_audit` con actor, destinatario, rol anterior, rol nuevo y fecha. El rol se consulta de nuevo en el servidor: una sesión antigua o una bandera enviada por el cliente no conservan derechos revocados. Los administradores iniciales conservan su acceso aunque la consulta de permisos de PostgreSQL falle; los demás fallan sin conceder acceso.

`server/schema/members.sql` contiene las dos tablas iniciales, creadas de forma idempotente por `db:init`. No hay una migración histórica ni se modifica el SQL o el checksum del esquema de inventario existente. Prepararlas conserva todos los datos del inventario.

`GET /api/admin/members/` y `POST /api/admin/members/` requieren una sesión y autorización de administrador. Las respuestas son privadas y no se almacenan en caché. El POST requiere origen propio, JSON de tamaño limitado y este cuerpo:

```json
{
  "objectId": "11111111-1111-4111-8111-111111111111",
  "expectedRole": "member",
  "role": "administrator"
}
```

El servidor comprueba la cuenta en Graph, rechaza cuentas deshabilitadas para una concesión y serializa los cambios por tenant. Dentro de la misma transacción vuelve a comprobar el permiso del actor, compara el rol esperado y escribe permiso y auditoría. Una lista desactualizada devuelve `409 role_conflict` sin sobrescribir otro cambio. Una revocación efectiva devuelve `403` en la siguiente petición administrativa. La interfaz ya abierta se actualiza al recargar o navegar.

La vista solo guarda derechos propios de Goliat; la identidad web no necesita permisos de escritura de usuarios ni `AppRoleAssignment.ReadWrite.All`. Los nombres y las cuentas solo se devuelven a administradores; los metadatos públicos al compartir la URL contienen únicamente el título y la descripción genéricos.
