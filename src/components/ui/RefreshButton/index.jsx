'use client';

import { useRef, useState } from 'react';
import { CircleCheck, CircleX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button.js';
import { toast } from '@/components/ui/Toaster/toast.js';
import { useI18n } from '@/i18n/useI18n.js';
import { cn } from '@/lib/utils.js';
import { REFRESH_TOAST_ID } from './constants.js';
import { useRefreshStatus } from '@/hooks/useRefreshStatus.js';

/** @param {import('./types.js').RefreshButtonProps} props */
export default function RefreshButton({ provider, onRefresh, loading = false, className }) {
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const shared = useRefreshStatus(provider);
  const busy = loading || refreshing || shared.running;
  const disabled = busy || shared.checking || shared.unavailable;
  const loadingIcon = <RefreshCw className="spinning" aria-hidden="true" />;
  const successIcon = <CircleCheck aria-hidden="true" />;
  const errorIcon = <CircleX aria-hidden="true" />;
  async function handleRefresh() {
    if (pending.current || disabled || !onRefresh) return;
    pending.current = true;
    setRefreshing(true);
    toast.loading(t('notifications.refreshing'), {
      id: REFRESH_TOAST_ID,
      icon: loadingIcon,
    });
    try {
      const result = await onRefresh();
      if (result?.ok === false) throw result.error;
      toast.success(t('notifications.refreshed'), {
        id: REFRESH_TOAST_ID,
        icon: successIcon,
      });
    } catch (error) {
      if (error?.code === 'refresh_busy' && error?.status === 409) {
        shared.markRunning();
        toast.info(t('notifications.refreshBusy'), { id: REFRESH_TOAST_ID, icon: loadingIcon });
      } else {
        toast.error(t('notifications.refreshFailed'), { id: REFRESH_TOAST_ID, icon: errorIcon });
      }
    } finally {
      pending.current = false;
      setRefreshing(false);
    }
  }
  return (
    <Button
      variant="outline"
      size="default"
      className={cn('bg-card', className)}
      onClick={handleRefresh}
      disabled={disabled}
      title={shared.unavailable ? t('notifications.refreshStatusUnavailable') : undefined}
    >
      <RefreshCw size={16} className={busy ? 'spinning' : undefined} aria-hidden="true" />
      {t(shared.running ? 'common.refreshInProgress' : 'common.refresh')}
    </Button>
  );
}
