import { useEffect, useRef, useState } from 'react';

export function useGridColumns(initialColumns = 1) {
  const gridRef = useRef(null);
  const [columns, setColumns] = useState(initialColumns);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    function measure() {
      const tracks = getComputedStyle(grid).gridTemplateColumns.trim();
      setColumns(tracks && tracks !== 'none' ? tracks.split(/\s+/).length : 1);
    }

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return { gridRef, columns };
}
