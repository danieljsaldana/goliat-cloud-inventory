import { Badge as StatusBadge } from '../primitives/badge.js';

export default function Badge({ children, muted = false }) {
  return (
    <StatusBadge variant="secondary" className={`status-badge ${muted ? 'neutral' : 'available'}`}>
      <span className="status-dot" />
      {children}
    </StatusBadge>
  );
}
