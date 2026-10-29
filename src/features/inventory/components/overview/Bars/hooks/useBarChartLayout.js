import { useEffect, useRef, useState } from 'react';
import { BAR_AXIS_LABEL_HEIGHT, BAR_AXIS_WIDTH, BAR_ROW_HEIGHT } from '../constants.js';
import { barChartLayout } from '../utils/barChartLayout.js';

export function useBarChartLayout(enabled) {
  const chartRef = useRef(null);
  const [layout, setLayout] = useState({
    axisWidth: BAR_AXIS_WIDTH,
    labelHeight: BAR_AXIS_LABEL_HEIGHT,
    rowHeight: BAR_ROW_HEIGHT,
  });

  useEffect(() => {
    if (!enabled) return;
    const chart = chartRef.current;
    if (!chart) return;
    const pending = { frame: null };
    const labels = new Set();

    function measure() {
      pending.frame = null;
      const labelHeight = Math.max(0, ...[...labels].map((label) => label.scrollHeight));
      const next = barChartLayout(chart.clientWidth, labelHeight);
      setLayout((current) => {
        if (
          current.axisWidth === next.axisWidth &&
          current.labelHeight === next.labelHeight &&
          current.rowHeight === next.rowHeight
        )
          return current;
        return next;
      });
    }

    function scheduleMeasure() {
      if (pending.frame !== null) return;
      pending.frame = window.requestAnimationFrame(measure);
    }

    const resizeObserver = new ResizeObserver(scheduleMeasure);

    function observeLabels() {
      for (const label of labels) {
        if (!chart.contains(label)) {
          resizeObserver.unobserve(label);
          labels.delete(label);
        }
      }
      for (const label of chart.querySelectorAll('[data-bar-axis-label]')) {
        if (labels.has(label)) continue;
        labels.add(label);
        resizeObserver.observe(label);
      }
      scheduleMeasure();
    }

    const mutationObserver = new MutationObserver(observeLabels);
    resizeObserver.observe(chart);
    mutationObserver.observe(chart, { childList: true, subtree: true, characterData: true });
    observeLabels();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (pending.frame !== null) window.cancelAnimationFrame(pending.frame);
    };
  }, [enabled]);

  return { chartRef, ...layout };
}
