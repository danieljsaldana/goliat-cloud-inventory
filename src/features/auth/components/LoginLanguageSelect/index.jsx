'use client';

import LanguagePicker from '@/i18n/LanguagePicker/index.jsx';
import { useLoginLocale } from '../../hooks/useLoginLocale.js';

export default function LoginLanguageSelect({ locale, target }) {
  const { setLocale } = useLoginLocale({ locale, target });
  return <LanguagePicker id="login-language" locale={locale} onValueChange={setLocale} />;
}
