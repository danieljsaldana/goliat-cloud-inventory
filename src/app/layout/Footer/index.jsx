import LanguageSelect from '../../../i18n/LanguageSelect/index.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import SiteFooter from '@/components/layout/SiteFooter/index.jsx';

export default function Footer() {
  const { locale } = useI18n();
  return (
    <SiteFooter locale={locale}>
      <LanguageSelect />
    </SiteFooter>
  );
}
