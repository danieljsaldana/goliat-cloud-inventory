import {
  DOCUMENT_SCHEMA_VERSION,
  RAW_REPORT_IDS,
} from '../../server/modules/azure/documentConstants.mjs';

export function azureDocument() {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    provider: 'azure',
    generatedAt: '2026-10-09T05:00:00.000Z',
    snapshot: {
      catalog: [{ subscriptionId: 'demo', subscriptionName: 'Demo', state: 'Enabled' }],
      tagKeys: ['environment'],
      reports: RAW_REPORT_IDS.map((id) => ({
        id,
        headers: [
          'subscriptionId',
          'name',
          'type',
          'enabled',
          'count',
          '$TAG_COLUMNS',
          'tags_json',
        ],
        rows:
          id === 'resources'
            ? [
                {
                  subscriptionId: 'demo',
                  name: 'demo-vm',
                  type: 'microsoft.compute/virtualmachines',
                  enabled: false,
                  count: 0,
                  tags: { Environment: 'demo' },
                },
              ]
            : [],
      })),
      totals: [{ subscriptionId: 'demo', resources: 1, distinctTypes: 1 }],
      tags: [
        {
          subscriptionId: 'demo',
          resourceProvider: 'microsoft.compute',
          type: 'microsoft.compute/virtualmachines',
          resources: 1,
          tagsJson: '{"Environment":"demo"}',
        },
      ],
    },
  };
}
