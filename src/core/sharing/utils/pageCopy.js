import { translate } from '../../i18n/translate.js';

export function pageCopy({ route, language, valid, report }) {
  const t = (key, values) => translate(language, key, values);
  if (!valid) return { title: t('notFound.title'), description: t('notFound.backHome') };
  if (route[0] === 'profile')
    return { title: t('profile.title'), description: t('profile.description') };
  if (route[0] === 'admin') return { title: t('admin.title'), description: t('admin.description') };
  if (route[0] === 'members')
    return { title: t('members.title'), description: t('members.description') };
  if (route[0] === 'architecture')
    return { title: t('architecture.title'), description: t('architecture.description') };
  if (route[0] === 'finops')
    return { title: t('finops.title'), description: t('finops.description') };
  if (report)
    return {
      title: `${t(report.labelKey)} · ${t('inventory.title')}`,
      description: t('sharing.reportDescription', { report: t(report.labelKey) }),
    };
  if (route[0] === 'inventario')
    return {
      title: t('inventory.title'),
      description: t('sharing.azureDescription'),
    };
  return { title: t('sharing.homeTitle'), description: t('sharing.homeDescription') };
}
