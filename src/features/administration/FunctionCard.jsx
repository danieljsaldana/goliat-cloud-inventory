import { ExternalLink, Server } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Badge } from '../../components/ui/primitives/badge.js';
import { Button } from '../../components/ui/primitives/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/primitives/card.js';

export default function FunctionCard({ resource }) {
  const { t } = useI18n();
  const running = resource.state?.toLowerCase() === 'running';
  const state = running ? t('admin.running') : resource.state;
  return (
    <Card as="section" className="admin-card admin-function">
      <CardHeader>
        <div className="admin-card-heading">
          <CardTitle as="h2">
            <Server size={19} aria-hidden="true" /> {t('admin.functionTitle')}
          </CardTitle>
          <Badge variant="outline" className={running ? 'admin-badge-success' : ''}>
            {state || '—'}
          </Badge>
        </div>
        <CardDescription>{t('admin.functionDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="admin-function-content">
        <div className="admin-resource-name">
          <span>{t('admin.name')}</span>
          <strong>{resource.name}</strong>
        </div>
        <dl className="admin-specs">
          <div>
            <dt>{t('admin.region')}</dt>
            <dd>{resource.location || '—'}</dd>
          </div>
          <div>
            <dt>{t('admin.runtime')}</dt>
            <dd>
              {resource.runtime?.name} {resource.runtime?.version}
            </dd>
          </div>
          <div>
            <dt>{t('admin.memoryLimit')}</dt>
            <dd>
              {resource.memoryMB ?? '—'} {t('admin.megabytes')}
            </dd>
          </div>
          <div>
            <dt>{t('admin.instances')}</dt>
            <dd>{resource.maximumInstances ?? '—'}</dd>
          </div>
        </dl>
        <div className="admin-host">
          <span>{t('admin.endpoint')}</span>
          <p>{resource.hostName || '—'}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" asChild>
          <a href={resource.portalUrl} target="_blank" rel="noreferrer">
            {t('admin.openPortal')} <ExternalLink size={15} aria-hidden="true" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
