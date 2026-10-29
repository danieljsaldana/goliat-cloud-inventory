import { Card, CardContent, CardHeader } from '../../components/ui/primitives/card.js';
import { Skeleton } from '../../components/ui/primitives/skeleton.js';

export default function AdministrationLoading() {
  return (
    <div className="admin-loading" aria-hidden="true">
      <Skeleton className="admin-skeleton-section" />
      <div className="admin-metrics">
        {[0, 1, 2].map((index) => (
          <Card key={index} className="admin-card">
            <CardHeader>
              <Skeleton className="admin-skeleton-title" />
              <Skeleton className="admin-skeleton-value" />
              <Skeleton className="admin-skeleton-caption" />
            </CardHeader>
            <CardContent>
              <Skeleton className="admin-skeleton-chart" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="admin-columns">
        {[0, 1].map((index) => (
          <Card key={index} className="admin-card">
            <CardHeader>
              <Skeleton className="admin-skeleton-title" />
              <Skeleton className="admin-skeleton-caption" />
            </CardHeader>
            <CardContent>
              <Skeleton className="admin-skeleton-panel" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="admin-card">
        <CardHeader>
          <Skeleton className="admin-skeleton-title" />
        </CardHeader>
        <CardContent>
          <Skeleton className="admin-skeleton-inventory" />
        </CardContent>
      </Card>
      <div className="admin-columns admin-data-services">
        {[0, 1].map((index) => (
          <Card key={index} className="admin-card">
            <CardHeader>
              <Skeleton className="admin-skeleton-title" />
              <Skeleton className="admin-skeleton-caption" />
            </CardHeader>
            <CardContent>
              <Skeleton className="admin-skeleton-panel" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
