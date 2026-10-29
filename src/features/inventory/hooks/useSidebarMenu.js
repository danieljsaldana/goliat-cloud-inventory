import { useEffect, useState } from 'react';
import { SIDEBAR_MEDIA_QUERY } from '../components/Sidebar/constants.js';

export function useSidebarMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const viewport = window.matchMedia(SIDEBAR_MEDIA_QUERY);
    function closeDesktopMenu() {
      if (!viewport.matches) setMenuOpen(false);
    }
    viewport.addEventListener('change', closeDesktopMenu);
    return () => viewport.removeEventListener('change', closeDesktopMenu);
  }, []);
  function changeMenu(open) {
    setMenuOpen(open && window.matchMedia(SIDEBAR_MEDIA_QUERY).matches);
  }
  function closeMenu() {
    setMenuOpen(false);
  }
  return { menuOpen, changeMenu, closeMenu };
}
