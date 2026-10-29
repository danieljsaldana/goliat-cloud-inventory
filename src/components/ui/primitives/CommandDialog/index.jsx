'use client';

import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { Command } from '../Command/index.jsx';
import { cn } from '@/lib/utils.js';

export function CommandDialog({
  children,
  trigger,
  title,
  description,
  closeLabel,
  className,
  commandProps,
  ...props
}) {
  return (
    <Dialog.Root {...props}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[12vh] z-50 w-[calc(100%_-_2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg',
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <Command shouldFilter={false} label={title} {...commandProps}>
            {children}
          </Command>
          <Dialog.Close className="global-search-close" aria-label={closeLabel}>
            <X size={18} aria-hidden="true" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
