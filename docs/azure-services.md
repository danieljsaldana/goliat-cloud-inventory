# Vistas de los servicios de Azure

El panel ofrece **73 vistas en 12 grupos**. Cada vista de servicio conserva filtros por suscripción, búsqueda, orden, agrupación, paginación y exportación. El menú permite buscar servicios en español e inglés.

Las vistas nuevas muestran primero el nombre y la configuración del servicio. En PostgreSQL y MySQL aparecen antes el estado, la versión, el almacenamiento y la retención de backups; los IDs y el contexto de suscripción quedan después.

La sección Inventario usa `/es/inventario/` y `/en/inventario/`. Las páginas usan nombres semánticos, por ejemplo `/es/inventario/functions/`, `/es/inventario/postgresql/` o `/en/inventario/public-ips/`. El mismo identificador se utiliza en el catálogo, el contrato JSON de la Function, PostgreSQL y la API: `/api/inventory/azure/functions/`. Las rutas de página `/es/azure/` y `/en/azure/`, incluidos sus informes, y las rutas numeradas se han eliminado y devuelven 404; no hay alias ni redirecciones.

## Organización

| Grupo                           | Servicios y vistas                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventario                      | Suscripciones, todos los recursos, grupos de recursos, distribución por tipo y totales                                                                                                                                                                           |
| Cómputo                         | Máquinas virtuales, resumen de VMs, VM Scale Sets y Azure Arc                                                                                                                                                                                                    |
| Contenedores                    | AKS, node pools, Container Registry y Container Apps                                                                                                                                                                                                             |
| Web, Functions y APIs           | Web Apps, App Service Plans, Azure Functions y API Management                                                                                                                                                                                                    |
| Red                             | VNets, subredes, private endpoints, NSG y reglas, servicios de red, DNS, tablas de rutas, IP públicas, balanceadores, Application Gateway, Azure Firewall, políticas de firewall, Front Door y CDN, VPN y ExpressRoute, NAT Gateway, Bastion e interfaces de red |
| Almacenamiento y backup         | Storage Accounts, discos administrados y almacenes de backup                                                                                                                                                                                                     |
| Bases de datos                  | Resumen de bases de datos, PostgreSQL, MySQL, SQL Server y bases SQL, Cosmos DB, Redis y Managed Redis                                                                                                                                                           |
| Seguridad e identidades         | Key Vault, inquilinos externos e identidades administradas asignadas por el usuario                                                                                                                                                                              |
| Integración y automatización    | Logic Apps, API Connections, Service Bus, Event Hubs, Event Grid, cuentas de Automation, runbooks y webhooks                                                                                                                                                     |
| Datos e inteligencia artificial | Servicios de IA, Azure OpenAI, Machine Learning, AI Search, Data Factory, Synapse y Databricks                                                                                                                                                                   |
| Observabilidad                  | Recursos de monitorización, Log Analytics, Application Insights y dashboards compartidos                                                                                                                                                                         |
| Etiquetas                       | Cobertura, catálogo de claves, recursos por etiqueta y agrupaciones globales y por suscripción                                                                                                                                                                   |

## Qué recoge la Function

Resource Graph proporciona los recursos visibles en las suscripciones configuradas. Los servicios anteriores tienen tablas específicas con columnas adecuadas a su tipo. Un servicio sin recursos se publica con sus cabeceras y filas vacías; no significa que haya fallado la recogida.

PostgreSQL y MySQL Flexible Server se enriquecen mediante GET de ARM para obtener versión, estado, tamaño de almacenamiento, backups, alta disponibilidad, acceso público y nombre del servidor. Red, VM, AKS y ciertos recursos hijos conservan sus consultas ARM adicionales. Si falla una consulta necesaria, no se publica un inventario parcial.

Esto recoge **configuración de recursos**, no el contenido de las aplicaciones: no extrae datos de las bases de datos, archivos de Storage, pipelines internos de Databricks, trabajos de Synapse ni secretos de Key Vault. Azure Arc muestra las máquinas conectadas. La vista de identidades muestra recursos `userAssignedIdentities`; las identidades de sistema pertenecen al recurso que las utiliza. Front Door y CDN incluye perfiles de CDN y ambos formatos de Front Door.

Solo se publican las columnas permitidas por el contrato. Las propiedades completas de ARM, contraseñas y credenciales no se exportan. Las vistas usan los mismos permisos de acceso que el dashboard de Azure.

## Contrato y desarrollo

La Function publica `schemaVersion: 2`: **69 informes de origen**. El backend produce además suscripciones, totales y las dos agrupaciones de etiquetas, hasta las 73 vistas. Todos los informes de origen son obligatorios, aunque no tengan filas. Se rechazan documentos con la versión anterior, identificadores desconocidos, informes duplicados o informes ausentes.

- [Catálogo de vistas y grupos](../src/core/inventory/reports/constants.js).
- [Tipos y columnas de servicios](../src/core/inventory/reports/service-reports.json).
- [Contrato de la Function](../functions/src/inventory/contract.json).
- [Guía de la Function](azure-function.md).

Al modificar columnas del catálogo, ejecutar `npm run inventory:sync`, actualizar el mapeo de propiedades del productor y comprobar `npm test` y `npm run test:functions`. Para actualizar el ejemplo vacío, ejecutar `npm run docs:azure-example`. Las filas de ejemplo son datos ficticios; la publicación real la genera la Function consultando Azure.

Desplegar la Function y la web con el mismo contrato y pulsar **Actualizar** en Azure. La web solicita la generación, espera su publicación en Storage e importa ese documento a PostgreSQL. No convierte los documentos antiguos al contrato nuevo.

Referencias de ARM: [PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/rest/api/postgresql/servers/get?view=rest-postgresql-2024-08-01) y [MySQL Flexible Server](https://learn.microsoft.com/en-us/rest/api/mysql/servers/get?view=rest-mysql-2024-12-30).
