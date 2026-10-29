import { useState } from 'react';
import { ExternalLink, Network } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';
import { Button } from '../../../components/ui/primitives/button.js';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/primitives/tabs.js';
import ArchitectureViewer from '../ArchitectureViewer/index.jsx';
import './ArchitecturePage.css';

export default function ArchitecturePage() {
  const { t } = useI18n();
  const [diagram, setDiagram] = useState('application');
  const document = diagram === 'azure' ? '/docs/azure-deployment.html' : '/docs/architecture.html';
  return (
    <main id="main" tabIndex={-1} className="architecture-page">
      <header className="architecture-heading">
        <div>
          <span className="eyebrow">
            <Network size={16} aria-hidden="true" /> {t('architecture.eyebrow')}
          </span>
          <h1>{t('architecture.title')}</h1>
          <p>{t('architecture.description')}</p>
        </div>
        <Button asChild variant="outline">
          <a href={`${document}?theme=light`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> {t('architecture.openDocument')}
          </a>
        </Button>
      </header>
      <Tabs value={diagram} onValueChange={setDiagram} className="architecture-tabs">
        <TabsList aria-label={t('architecture.diagrams')}>
          <TabsTrigger value="application">{t('architecture.application')}</TabsTrigger>
          <TabsTrigger value="azure">{t('architecture.azure')}</TabsTrigger>
        </TabsList>
        <TabsContent value="application">
          <ArchitectureViewer
            document="/docs/architecture.html"
            title={t('architecture.diagramTitle')}
          />
        </TabsContent>
        <TabsContent value="azure">
          <p className="architecture-snapshot">{t('architecture.azureSnapshot')}</p>
          <ArchitectureViewer
            document="/docs/azure-deployment.html"
            title={t('architecture.azureDiagramTitle')}
          />
        </TabsContent>
      </Tabs>
      <p className="architecture-help">{t('architecture.help')}</p>
    </main>
  );
}
