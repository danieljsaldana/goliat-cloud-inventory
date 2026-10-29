/**
 * @typedef {{label?: string, color?: string, theme?: {light: string, dark: string}, icon?: import('react').ComponentType}} ChartSeries
 * @typedef {Record<string, ChartSeries>} ChartConfig
 * @typedef {import('react').ComponentProps<'div'> & {config: ChartConfig, children: import('react').ReactNode, initialDimension?: {width: number, height: number}}} ChartContainerProps
 */
export {};
