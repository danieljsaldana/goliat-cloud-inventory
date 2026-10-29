import { ArrowLeft, UserRound } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';
import AppLink from '../../../app/routing/AppLink/index.jsx';
import { Button } from '../../../components/ui/primitives/button.js';
import { Badge } from '../../../components/ui/primitives/badge.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/primitives/card.js';
import UserAvatar from '../components/UserAvatar/index.jsx';
import LogoutForm from '../components/LogoutForm/index.jsx';

export default function ProfilePage({ access }) {
  const { t } = useI18n();
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <Button asChild variant="ghost" className="mb-6">
        <AppLink to="/">
          <ArrowLeft aria-hidden="true" />
          {t('profile.backHome')}
        </AppLink>
      </Button>
      <header className="mb-8">
        <span className="eyebrow">
          <UserRound size={16} aria-hidden="true" />
          {t('auth.account')}
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t('profile.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('profile.description')}</p>
      </header>
      <Card>
        <CardHeader className="flex flex-row items-center gap-5">
          <UserAvatar
            image={access.image}
            name={access.name}
            className="size-20 shrink-0 [&_svg]:size-8"
          />
          <div className="min-w-0">
            <CardTitle as="h2" className="break-words text-xl">
              {access.name || t('auth.account')}
            </CardTitle>
            <CardDescription className="mt-2 break-words">
              {access.email || t('profile.emailUnavailable')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <dt className="text-sm text-muted-foreground">{t('profile.name')}</dt>
              <dd className="min-w-0 break-words">{access.name || '—'}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <dt className="text-sm text-muted-foreground">{t('profile.email')}</dt>
              <dd className="min-w-0 break-words">
                {access.email || t('profile.emailUnavailable')}
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <dt className="text-sm text-muted-foreground">{t('members.role')}</dt>
              <dd>
                <Badge variant="outline">
                  {t(access.administrator ? 'members.role.administrator' : 'members.role.member')}
                </Badge>
              </dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-border pt-4">
            <LogoutForm dropdown={false} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
