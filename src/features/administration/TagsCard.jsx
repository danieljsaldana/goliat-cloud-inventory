import { useMemo } from 'react';
import { Tags } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/primitives/card.js';
import { inventoryTagKeys } from './utils/inventoryTagKeys.js';
import TagsForm from './TagsForm.jsx';

export default function TagsCard({ tags, inventory, reload, disabled }) {
  const { t } = useI18n();
  const available = useMemo(() => inventoryTagKeys(inventory.files), [inventory.files]);
  return (
    <Card as="section" className="admin-card admin-tags" aria-labelledby="admin-tags-title">
      <CardHeader>
        <CardTitle as="h2" id="admin-tags-title">
          <Tags size={19} aria-hidden="true" /> {t('admin.tagsTitle')}
        </CardTitle>
        <CardDescription>{t('admin.tagsHelp')}</CardDescription>
      </CardHeader>
      <CardContent>
        {tags ? (
          <TagsForm
            key={tags.version}
            tags={tags}
            available={available}
            reload={reload}
            disabled={disabled || inventory.loading}
          />
        ) : (
          <p className="admin-help" role="status">
            {t('admin.tagsUnavailable')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
