import {
  inventoryReportFilters,
  getInventoryReport,
} from '../../../../../server/modules/azure/services/inventoryReport.mjs';
import { protectedRoute } from '../../../../../server/route-access.mjs';
import { getLogger } from '../../../../../server/logging/logger.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = protectedRoute(
  async function GET(request, { params }) {
    const { reportId } = await params;
    const parsed = { filters: null };
    try {
      parsed.filters = inventoryReportFilters(reportId, new URL(request.url).searchParams);
    } catch {
      return Response.json({ error: 'invalid_filters' }, { status: 400 });
    }
    try {
      const report = await getInventoryReport(parsed.filters);
      if (!report) return Response.json({ error: 'report_not_found' }, { status: 404 });
      return Response.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
      getLogger().error(
        { err: error, event: 'inventory.report.unavailable' },
        'No se puede consultar el informe de Azure.',
      );
      return Response.json({ error: 'inventory_unavailable' }, { status: 503 });
    }
  },
  { route: '/api/inventory/azure/[reportId]/' },
);
