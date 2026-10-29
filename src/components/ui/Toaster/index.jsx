'use client';

import { Toaster as Sonner } from 'sonner';
import { useI18n } from '@/i18n/useI18n.js';
import { TOAST_DURATION, TOAST_LIMIT, TOAST_SWIPE_DIRECTIONS, TOASTER_STYLE } from './constants.js';
import './Toaster.css';

/** @param {import('./types.js').ToasterProps} props */
export default function Toaster({ toastOptions, style, ...props }) {
  const { t } = useI18n();
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-right"
      closeButton
      duration={TOAST_DURATION}
      visibleToasts={TOAST_LIMIT}
      swipeDirections={TOAST_SWIPE_DIRECTIONS}
      customAriaLabel={t('notifications.region')}
      style={{ ...TOASTER_STYLE, ...style }}
      toastOptions={{ closeButtonAriaLabel: t('notifications.close'), ...toastOptions }}
      {...props}
    />
  );
}
