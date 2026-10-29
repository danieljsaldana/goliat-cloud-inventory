export function dashboardCopy(provider, report) {
  if (report)
    return {
      title: report.labelKey,
      breadcrumb: report.labelKey,
      ...(report.summary ? { description: 'category.description' } : {}),
    };
  return {
    title: 'inventory.title',
    description: `dashboard.${provider}Description`,
    breadcrumb: 'nav.overview',
  };
}
