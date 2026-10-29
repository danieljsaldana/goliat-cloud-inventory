'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Cloud, Home, Menu, Network, ShieldCheck, Users, Wallet } from 'lucide-react';
import AppLink from '../../routing/AppLink/index.jsx';
import { NAV_LINKS } from '../MainNavigation/constants.js';
import { useI18n } from '@/i18n/useI18n.js';
import LanguagePicker from '@/i18n/LanguagePicker/index.jsx';
import UserAvatar from '@/features/auth/components/UserAvatar/index.jsx';
import LogoutForm from '@/features/auth/components/LogoutForm/index.jsx';
import { Button } from '@/components/ui/primitives/button.js';
import { Badge } from '@/components/ui/primitives/badge.js';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/primitives/sheet.js';
import './MobileNavigation.css';

const LINK_ICONS = {
  '': Home,
  inventario: Cloud,
  finops: Wallet,
  architecture: Network,
  members: Users,
  admin: ShieldCheck,
};

export default function MobileNavigation({ section, access }) {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState(null);
  const links = NAV_LINKS.filter((link) => !link.administrator || access?.administrator);
  const open = openPath === pathname;

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 950px)');
    function closeOnDesktop(event) {
      if (!event.matches) setOpenPath(null);
    }
    function closeOnHistoryChange() {
      setOpenPath(null);
    }
    viewport.addEventListener('change', closeOnDesktop);
    window.addEventListener('popstate', closeOnHistoryChange);
    return () => {
      viewport.removeEventListener('change', closeOnDesktop);
      window.removeEventListener('popstate', closeOnHistoryChange);
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => setOpenPath(nextOpen ? pathname : null)}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="mobile-navigation-trigger"
          aria-label={t('nav.openMainMenu')}
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="mobile-navigation-panel" closeLabel={t('nav.closeMenu')}>
        <div className="mobile-navigation-header">
          <AppLink
            className="brand"
            to="/"
            aria-label={t('nav.brandHome')}
            onClick={() => setOpenPath(null)}
          >
            <span className="brand-logo" role="img" aria-label={t('brand.logo')} />
            <small>{t('brand.tagline')}</small>
          </AppLink>
          <SheetTitle>{t('nav.mobileTitle')}</SheetTitle>
          <SheetDescription className="sr-only">{t('nav.mobileDescription')}</SheetDescription>
        </div>
        <div className="mobile-navigation-body">
          <nav aria-label={t('nav.main')}>
            <ul className="mobile-navigation-links">
              {links.map((link, index) => {
                const Icon = LINK_ICONS[link.id];
                return (
                  <li key={link.id}>
                    {link.administrator && !links[index - 1]?.administrator && (
                      <h3 className="mobile-navigation-management">{t('admin.title')}</h3>
                    )}
                    <AppLink
                      to={link.path}
                      className={section === link.id ? 'selected' : undefined}
                      aria-current={section === link.id ? 'page' : undefined}
                      onClick={() => setOpenPath(null)}
                    >
                      <Icon size={20} aria-hidden="true" />
                      {t(link.label)}
                    </AppLink>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mobile-navigation-footer">
            {access?.enabled && (
              <div className="mobile-navigation-account">
                <UserAvatar image={access.image} name={access.name} className="size-10" />
                <div>
                  <strong>{access.name || t('auth.account')}</strong>
                  <Badge variant="secondary">
                    {t(access.administrator ? 'members.role.administrator' : 'members.role.member')}
                  </Badge>
                </div>
              </div>
            )}
            <LanguagePicker
              locale={locale}
              onValueChange={(nextLocale) => {
                setOpenPath(null);
                setLocale(nextLocale);
              }}
              id="mobile-display-language"
            />
            {access?.enabled && <LogoutForm dropdown={false} />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
