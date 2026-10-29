import SiteFooter from '@/components/layout/SiteFooter/index.jsx';
import LoginLanguageSelect from '../LoginLanguageSelect/index.jsx';

export default function LoginFooter({ locale, target }) {
  return (
    <SiteFooter locale={locale}>
      <LoginLanguageSelect locale={locale} target={target} />
    </SiteFooter>
  );
}
