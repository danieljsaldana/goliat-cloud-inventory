import './ChartCard.css';
import { ChartNoAxesCombined } from 'lucide-react';
import { Card } from '@/components/ui/primitives/card.js';

export default function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <Card as="section" className={`chart-card ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <ChartNoAxesCombined size={18} />
      </div>
      {children}
    </Card>
  );
}
