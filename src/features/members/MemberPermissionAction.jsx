'use client';

import { useState } from 'react';
import { LockKeyhole, ShieldMinus, ShieldPlus } from 'lucide-react';
import { Tooltip } from 'radix-ui';
import { useI18n } from '../../i18n/useI18n.js';
import { Button } from '../../components/ui/primitives/button.js';

function permissionMessage(user, self, disabled) {
  if (user.protectedAdministrator) return 'members.protected';
  if (self) return 'members.selfProtected';
  if (!user.enabled && user.role !== 'administrator') return 'members.error.member_disabled';
  if (disabled) return 'members.loading';
  return user.role === 'administrator' ? 'members.revokeShort' : 'members.grantShort';
}

export default function MemberPermissionAction({ user, self, disabled, onSelect }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState('top');
  const administrator = user.role === 'administrator';
  const protectedRole = user.protectedAdministrator || self;
  const disabledAccount = !user.enabled && !administrator;
  const unavailable = protectedRole || disabledAccount || disabled;
  const ActionIcon = administrator ? ShieldMinus : ShieldPlus;
  const Icon = protectedRole ? LockKeyhole : ActionIcon;
  const message = t(permissionMessage(user, self, disabled));

  function positionTooltip(event) {
    setSide(event.currentTarget.getBoundingClientRect().top < 112 ? 'right' : 'top');
  }

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="members-permission-button"
          aria-disabled={unavailable && !protectedRole}
          data-protected={protectedRole || undefined}
          aria-label={
            unavailable
              ? message
              : t(administrator ? 'members.revoke' : 'members.grant', { name: user.name })
          }
          onPointerEnter={positionTooltip}
          onFocus={positionTooltip}
          onPointerDown={(event) => {
            if (event.pointerType === 'touch' && !unavailable) {
              positionTooltip(event);
              setOpen(true);
            }
          }}
          onClick={(event) => {
            if (unavailable) {
              event.preventDefault();
              positionTooltip(event);
              setOpen(true);
              return;
            }
            setOpen(false);
            onSelect(user);
          }}
        >
          <Icon className="size-5" aria-hidden="true" />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="members-permission-tooltip"
          side={side}
          sideOffset={8}
          collisionPadding={12}
        >
          {message}
          <Tooltip.Arrow className="members-permission-tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
