import './Kpi.css';
import { Card } from '@/components/ui/primitives/card.js';
export default function Kpi({ label, value, note, icon: Icon, accent = false }) {
  return (
    <Card className={`kpi gap-0 py-0 ${accent ? 'accent' : ''}`}>
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </Card>
  );
}
