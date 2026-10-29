import { THEMES } from '../constants.js';

export function chartStyles(id, config) {
  const colors = Object.entries(config).filter(([, series]) => series.theme || series.color);
  return Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const variables = colors
        .map(([key, series]) => {
          const color = series.theme?.[theme] || series.color;
          return color ? `--color-${key}: ${color};` : '';
        })
        .join('\n');
      return `${prefix} [data-chart="${id}"] {\n${variables}\n}`;
    })
    .join('\n');
}
