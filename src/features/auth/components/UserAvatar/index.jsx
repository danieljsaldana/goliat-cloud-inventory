import { UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives/avatar.js';
import { cn } from '@/lib/utils.js';
import { useI18n } from '@/i18n/useI18n.js';

/** @param {import('./types.js').UserAvatarProps} props */
export default function UserAvatar({ image, name, className }) {
  const { t } = useI18n();
  return (
    <Avatar className={cn('size-7 border border-border', className)}>
      <AvatarImage
        src={image || undefined}
        alt={t('auth.userPhoto', { name: name || t('auth.account') })}
        referrerPolicy="no-referrer"
      />
      <AvatarFallback
        role="img"
        aria-label={t('auth.defaultAvatar')}
        className="text-muted-foreground"
      >
        <UserRound className="size-4" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}
