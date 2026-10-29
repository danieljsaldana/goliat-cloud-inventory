import { Button } from '../../../../components/ui/primitives/button.js';
import { Menu } from 'lucide-react';
import AppLink from '../../../../app/routing/AppLink/index.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { SheetTrigger } from '@/components/ui/primitives/sheet.js';
import DateLabel from '@/components/DateLabel/index.jsx';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/primitives/breadcrumb.js';
import './DashboardBreadcrumb.css';

export default function DashboardBreadcrumb({ provider, label, metadata }) {
  const { t } = useI18n();
  return (
    <div className="breadcrumb dashboard-breadcrumb">
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="mobile-menu"
          aria-label={t('nav.openMenu')}
        >
          <Menu size={18} />
        </Button>
      </SheetTrigger>
      <Breadcrumb aria-label={t('nav.breadcrumb')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <AppLink to="/">{t('common.home')}</AppLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <AppLink to="/inventario">{t('inventory.title')}</AppLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t(label)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {provider === 'azure' && <DateLabel metadata={metadata} />}
    </div>
  );
}
