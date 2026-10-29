import { Boxes, Layers, ArrowUpRight, LayoutList } from 'lucide-react';
import { CommandItem } from '@/components/ui/primitives/command.js';

export default function SearchResultItem({ entry, select }) {
  const icons = { resources: Boxes, subscriptions: Layers, reports: LayoutList };
  const Icon = icons[entry.kind];
  return (
    <CommandItem value={`${entry.kind}:${entry.key}`} onSelect={() => select(entry)}>
      <Icon size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="global-search-result">
        <span className="global-search-name">{entry.name}</span>
        {entry.kind === 'resources' && (
          <span className="global-search-meta">
            {[entry.subscriptionName, entry.resourceGroup].filter(Boolean).join(' · ')}
          </span>
        )}
        {entry.kind !== 'reports' && <span className="global-search-id">{entry.id}</span>}
      </span>
      <ArrowUpRight
        size={16}
        className="ml-auto shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </CommandItem>
  );
}
