import { ChevronDown } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';
import { Button } from '@/components/ui/primitives/button.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/primitives/dropdown-menu.js';
import LogoutForm from '../components/LogoutForm/index.jsx';
import UserAvatar from '../components/UserAvatar/index.jsx';
import AppLink from '../../../app/routing/AppLink/index.jsx';

/** @param {import('./types.js').AccountMenuProps} props */
export default function AccountMenu({ access }) {
  const { t } = useI18n();
  if (!access?.enabled) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="account-menu py-1.5" aria-label={t('auth.account')}>
          <UserAvatar image={access.image} name={access.name} />
          <span className="account-name">{access.name || t('auth.account')}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild className="gap-3">
          <AppLink to="/profile/" aria-label={t('profile.view')}>
            <UserAvatar image={access.image} name={access.name} className="size-9" />
            <div className="min-w-0">
              {t('auth.signedInAs')}
              <span className="block truncate font-normal text-muted-foreground">
                {access.name}
              </span>
            </div>
          </AppLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LogoutForm />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
