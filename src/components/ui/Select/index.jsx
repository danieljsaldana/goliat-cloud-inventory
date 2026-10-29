'use client';

import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select.js';
import { EMPTY_SELECT_VALUE } from './constants.js';
import { selectValue } from './utils/selectValue.js';
import PaginatedSelect from './PaginatedSelect/index.jsx';
import { useAnchoredPopup } from '../useAnchoredPopup.js';

export default function Select({
  options,
  value,
  onValueChange,
  disabled,
  name,
  className = '',
  size,
  ...props
}) {
  const popup = useAnchoredPopup();
  if (options.length > 20)
    return (
      <PaginatedSelect
        options={options}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
        className={className}
        size={size}
        {...props}
      />
    );
  return (
    <SelectRoot
      open={popup.open}
      onOpenChange={popup.setOpen}
      name={name}
      value={selectValue(value)}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next === EMPTY_SELECT_VALUE ? '' : next)}
    >
      <SelectTrigger
        ref={popup.triggerRef}
        className={`select-control ${className}`}
        size={size}
        {...props}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={selectValue(option.value)}
            disabled={option.disabled}
            lang={option.lang}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
