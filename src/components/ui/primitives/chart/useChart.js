import { useContext } from 'react';
import { ChartContext } from './ChartContext.js';

export function useChart(config) {
  const context = useContext(ChartContext);
  if (config) return { config };
  if (!context) throw new Error('useChart requires ChartContainer.');
  return context;
}
