'use client';

import { useState } from 'react';
import { Popover } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '../../primitives/button.js';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../primitives/command.js';
import Pagination from '../../Pagination/index.jsx';
import { usePagination } from '../../usePagination.js';
import { useI18n } from '@/i18n/useI18n.js';
import { filterOptions } from '../utils/filterOptions.js';
import { useAnchoredPopup } from '../../useAnchoredPopup.js';
import './PaginatedSelect.css';

export default function PaginatedSelect({
  options,
  value,
  onValueChange,
  disabled,
  name,
  className = '',
  size,
  ...props
}) {
  const { t } = useI18n();
  const { open, setOpen, triggerRef } = useAnchoredPopup();
  const [query, setQuery] = useState('');
  const filtered = filterOptions(options, query);
  const pagination = usePagination(filtered, 20, query);
  const selected = options.find((option) => String(option.value) === String(value));
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery('');
          pagination.setPage(0);
        }
      }}
    >
      {name && <input type="hidden" name={name} value={value ?? ''} disabled={disabled} />}
      <Popover.Trigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`select-control paginated-select-trigger ${className}`}
          data-size={size || 'default'}
          title={selected?.label}
          {...props}
        >
          <span data-slot="select-value">{selected?.label || t('select.choose')}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="paginated-select-content"
          align="start"
          sideOffset={4}
          collisionPadding={16}
          updatePositionStrategy="always"
          sticky="always"
        >
          <Command shouldFilter={false} loop vimBindings={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              aria-label={t('select.search')}
              placeholder={t('select.search')}
            />
            <CommandList>
              <CommandEmpty>{t('table.noResults')}</CommandEmpty>
              {pagination.items.map((option) => (
                <CommandItem
                  key={option.value}
                  value={JSON.stringify([option.value])}
                  disabled={option.disabled}
                  lang={option.lang}
                  onSelect={() => {
                    onValueChange(String(option.value));
                    setOpen(false);
                  }}
                >
                  <Check
                    size={16}
                    aria-hidden="true"
                    className={String(option.value) === String(value) ? '' : 'invisible'}
                  />
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
          <Pagination
            total={filtered.length}
            label={props['aria-label'] || t('select.options')}
            showPageSize={false}
            {...pagination}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
