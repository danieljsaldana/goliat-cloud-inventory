import { BAR_AXIS_LABEL_PADDING, BAR_AXIS_TICK_MARGIN } from '../constants.js';

/** @param {import('./types.js').BarAxisTickProps} props */
export default function BarAxisTick({ x = 0, y = 0, payload, className, axisWidth, labelHeight }) {
  const labelWidth = axisWidth - BAR_AXIS_TICK_MARGIN - BAR_AXIS_LABEL_PADDING;
  return (
    <foreignObject
      x={x - labelWidth}
      y={y - labelHeight / 2}
      width={labelWidth}
      height={labelHeight}
      className={className}
    >
      <div className="flex h-full min-w-0 items-center text-muted-foreground">
        <span
          data-bar-axis-label=""
          className="block w-full text-right whitespace-normal [overflow-wrap:anywhere]"
        >
          {payload?.value}
        </span>
      </div>
    </foreignObject>
  );
}
