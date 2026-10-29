import AppLink from '../../routing/AppLink/index.jsx';
import { useI18n } from '@/i18n/useI18n.js';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from '@/components/ui/primitives/navigation-menu.js';
import { NAV_LINKS } from './constants.js';

export default function MainNavigation({ section, administrator }) {
  const { t } = useI18n();
  return (
    <NavigationMenu className="top-nav" aria-label={t('nav.main')}>
      <NavigationMenuList>
        {NAV_LINKS.filter((link) => !link.administrator || administrator).map((link) => (
          <NavigationMenuItem key={link.id}>
            <NavigationMenuLink
              asChild
              active={section === link.id}
              className={section === link.id ? 'selected' : ''}
            >
              <AppLink to={link.path} aria-current={section === link.id ? 'page' : undefined}>
                {t(link.label)}
              </AppLink>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
