import { chartStyles } from '../chart/utils/chartStyles.js';

export function ChartStyle({ id, config }) {
  if (!Object.values(config).some((series) => series.color || series.theme)) return null;
  return <style dangerouslySetInnerHTML={{ __html: chartStyles(id, config) }} />;
}
