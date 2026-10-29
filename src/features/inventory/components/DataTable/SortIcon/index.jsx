import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export default function SortIcon({ selected, direction }) {
  if (!selected) return <ArrowUpDown size={13} className="sort-indicator" aria-hidden="true" />;
  if (direction === 1)
    return <ArrowUp size={13} className="sort-indicator is-sorted" aria-hidden="true" />;
  return <ArrowDown size={13} className="sort-indicator is-sorted" aria-hidden="true" />;
}
