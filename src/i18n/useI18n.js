import { useContext } from 'react';
import { I18nContext } from './I18nContext.js';

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n requires I18nProvider');
  return context;
}
