# FinOps

La sección `/es/finops/` y `/en/finops/` consulta gastos reales de Azure Cost Management. Usa los componentes shadcn del producto: filtros Select, Button, Card, ChartContainer con Recharts, Table, Pagination, Alert, Empty y Skeleton. Conserva el tema y los idiomas existentes.

## Primera integración

- Selector de los últimos doce meses, usando fechas UTC.
- Coste real o amortizado, antes de impuestos.
- Filtros de suscripción y moneda; nunca se suman monedas distintas.
- Gasto total del periodo, evolución diaria y distribución por recurso, servicio, suscripción o grupo de recursos.
- Los importes se muestran con un decimal; los cálculos conservan toda la precisión de Azure. La distribución por recurso suma sus servicios y créditos, mantiene separados los recursos con el mismo nombre y muestra su identificador completo al consultar una barra.
- Gráfico de tarta con porcentajes de gasto por recurso: cinco recursos principales y un sector para el resto, con importe y porcentaje al consultar cada sector. La tabla paginada muestra todos los recursos y sus porcentajes sobre el mismo conjunto filtrado; cambiar de página no cambia el denominador.
- Los porcentajes se calculan sobre los saldos positivos de cada recurso después de sumar servicios y créditos. Los saldos negativos y cero permanecen en las tablas y en el total, sin representarse como sectores. Se indica la base del porcentaje y los saldos negativos; los porcentajes positivos inferiores al 0,1 % se muestran como tales, sin convertirse en cero.
- Detalle paginado y buscable de gastos por recurso y servicio. Los recursos presentes enlazan al inventario. Los eliminados y cargos sin recurso mantienen sus importes.
- Estados de carga, ausencia de registros, errores de acceso, limitación de consultas y resultados parciales. Los días sin datos aparecen como huecos.

El navegador llama a `GET /api/finops/costs/?month=YYYY-MM&basis=ActualCost`. También admite `AmortizedCost`. La API usa el mismo control de acceso que Inventario, valida periodo y base de coste, y fija las suscripciones en el servidor. No acepta IDs ni endpoints cloud enviados por el navegador.

El servidor consulta la [Query API](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage?view=rest-cost-management-2025-03-01), agrega `PreTaxCost` con granularidad diaria y agrupa por `ResourceId` y `ServiceName`. Sigue todas las páginas mediante POST, limita filas y tamaño, y rechaza continuaciones fuera de la suscripción o del origen ARM. Las suscripciones se consultan con concurrencia limitada. Un fallo no oculta los resultados de las demás.

## Configuración

`FINOPS_SUBSCRIPTION_IDS` contiene IDs de suscripción separados por comas, con un máximo de veinte. Vacío reutiliza el catálogo del inventario guardado. No se descubren otras suscripciones de la cuenta automáticamente.

`FINOPS_AUTH_MODE` admite `default`, `client-secret` y `managed-identity`; si se omite, reutiliza `AZURE_AUTH_MODE`. En local, `default` utiliza `DefaultAzureCredential`, que puede usar la sesión de `az login`. Si hay credenciales Azure en el entorno, la cadena puede seleccionarlas antes que Azure CLI. En producción se usa la identidad administrada de la web.

El despliegue de `iac/web.bicep` configura las suscripciones del inventario y asigna a la identidad web **Cost Management Reader** en cada una mediante `iac/finops.bicep`. El desplegador necesita permisos para asignar roles en esos ámbitos, incluidos los de otras suscripciones. No hace falta modificar la identidad del productor de inventario. Las políticas de facturación de EA, MCA o CSP pueden requerir habilitar acceso adicional; consulta [los permisos de Cost Management](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/assign-access-acm-data).

## Actualización y límites

La fecha mostrada es la de consulta a Azure, no la de cierre de factura. Los importes del mes abierto son estimados y pueden revisarse o llegar con retraso. La [disponibilidad de datos de costes](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/understand-cost-mgt-data) depende del contrato y los servicios.

La caché es privada del proceso servidor, con una duración máxima de diez minutos, separación por identidad, periodo y tipo de coste, y un límite de treinta y dos consultas. Las consultas simultáneas comparten el resultado. Los resultados parciales se conservan treinta segundos. Actualizar recarga los datos disponibles, sin saltarse los límites de caché. Cada réplica tiene su propia caché.

Cada proceso admite como máximo dos consultas de periodos diferentes en curso, con cuatro suscripciones concurrentes por consulta; el exceso devuelve `429` y `Retry-After: 5`. El resultado conjunto queda limitado a 50.000 filas y 8 MiB de datos de filas, y la caché completa a 16 MiB de JSON. Las suscripciones que exceden el límite figuran como no disponibles; sus importes no se incluyen ni se anuncian como cero.

El histórico de esta versión procede de Azure; no se almacena un libro de gastos en PostgreSQL. No se calculan presupuestos, previsiones, ahorro recomendado ni reparto por etiquetas actuales. Esas funciones requieren contratos y reglas adicionales, especialmente para etiquetas históricas y costes compartidos.
