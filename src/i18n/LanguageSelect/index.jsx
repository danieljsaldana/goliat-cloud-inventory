import LanguagePicker from '../LanguagePicker/index.jsx';
import { useI18n } from '../useI18n.js';

export default function LanguageSelect() {
  const { locale, setLocale } = useI18n();
  return <LanguagePicker locale={locale} onValueChange={setLocale} />;
}
