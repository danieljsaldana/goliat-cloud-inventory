import { useEffect } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { toast } from '../../../components/ui/Toaster/toast.js';
import { SIGN_IN_NOTICE_PARAM, SIGN_IN_NOTICE_VALUE, SIGN_IN_TOAST_ID } from '../constants.js';

export function useSignInNotification(enabled) {
  const { t } = useI18n();
  useEffect(() => {
    if (!enabled) return;
    const destination = new URL(window.location.href);
    if (destination.searchParams.get(SIGN_IN_NOTICE_PARAM) !== SIGN_IN_NOTICE_VALUE) return;
    destination.searchParams.delete(SIGN_IN_NOTICE_PARAM);
    window.history.replaceState(
      window.history.state,
      '',
      `${destination.pathname}${destination.search}${destination.hash}`,
    );
    toast.success(t('notifications.signedIn'), { id: SIGN_IN_TOAST_ID });
  }, [enabled, t]);
}
