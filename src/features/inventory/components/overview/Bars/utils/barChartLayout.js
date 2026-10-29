import {
  BAR_AXIS_LABEL_HEIGHT,
  BAR_AXIS_MAX_WIDTH,
  BAR_AXIS_MIN_WIDTH,
  BAR_AXIS_WIDTH_RATIO,
  BAR_ROW_GAP,
  BAR_ROW_HEIGHT,
} from '../constants.js';

export function barChartLayout(width, labelHeight) {
  return {
    axisWidth: Math.round(
      Math.min(BAR_AXIS_MAX_WIDTH, Math.max(BAR_AXIS_MIN_WIDTH, width * BAR_AXIS_WIDTH_RATIO)),
    ),
    labelHeight: Math.max(BAR_AXIS_LABEL_HEIGHT, Math.ceil(labelHeight)),
    rowHeight: Math.max(BAR_ROW_HEIGHT, Math.ceil(labelHeight) + BAR_ROW_GAP),
  };
}
