'use client';

import { Label } from '../../components/ui/primitives/label.js';
import { Globe } from 'lucide-react';
import Select from '../../components/ui/Select/index.jsx';
import { LANGUAGES } from '../../core/i18n/config.js';
import { translate } from '../../core/i18n/translate.js';
import './LanguagePicker.css';

export default function LanguagePicker({ locale, onValueChange, id = 'display-language' }) {
  const label = translate(locale, 'language.label');
  return (
    <Label className="language-picker" htmlFor={id}>
      <Globe size={15} aria-hidden="true" />
      <span>{label}</span>
      <Select
        id={id}
        aria-label={label}
        value={locale}
        onValueChange={onValueChange}
        options={LANGUAGES.map((language) => ({
          value: language.id,
          label: language.name,
          lang: language.id,
        }))}
      />
    </Label>
  );
}
