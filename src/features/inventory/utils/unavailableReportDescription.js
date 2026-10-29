export function unavailableReportDescription(missingTagDependency, report) {
  if (missingTagDependency) return 'dashboard.globalTagsDependency';
  if (report) return 'dashboard.fileUnavailable';
  return 'dashboard.selectView';
}
