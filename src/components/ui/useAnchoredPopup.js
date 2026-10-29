import { useEffect, useRef, useState } from 'react';

export function useAnchoredPopup() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setOpen(false);
    });
    observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, [open]);
  return { open, setOpen, triggerRef };
}
