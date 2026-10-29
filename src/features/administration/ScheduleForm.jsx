import { useState } from 'react';
import { Info, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../i18n/useI18n.js';
import Select from '../../components/ui/Select/index.jsx';
import { Alert, AlertDescription } from '../../components/ui/primitives/alert.js';
import { Badge } from '../../components/ui/primitives/badge.js';
import { Button } from '../../components/ui/primitives/button.js';
import { Input } from '../../components/ui/primitives/input.js';
import { Label } from '../../components/ui/primitives/label.js';
import { Spinner } from '../../components/ui/primitives/spinner.js';
import { Switch } from '../../components/ui/primitives/switch.js';
import { saveSchedule } from './api/functionAdministration.js';

export default function ScheduleForm({ schedule, reload, disabled = false }) {
  const { t } = useI18n();
  const initialMode = schedule.mode;
  const [mode, setMode] = useState(initialMode);
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [time, setTime] = useState(schedule.time);
  const [hours, setHours] = useState(schedule.hours);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const changed =
    enabled !== schedule.enabled ||
    mode !== initialMode ||
    (mode === 'daily' && time !== schedule.time) ||
    (mode === 'hourly' && hours !== schedule.hours);
  const busy = saving || disabled;
  const dailySummary = t('admin.dailyAt', { time: schedule.time });
  const hourlySummary = t('admin.everyHours', { count: schedule.hours });
  const presetSummary = schedule.mode === 'hourly' ? hourlySummary : dailySummary;
  const summary = schedule.mode === 'custom' ? t('admin.customFrequency') : presetSummary;
  function edit(update, value) {
    update(value);
    setMessage('');
    setSaved(false);
  }
  function discard() {
    setMode(initialMode);
    setEnabled(schedule.enabled);
    setTime(schedule.time);
    setHours(schedule.hours);
    setMessage('');
    setSaved(false);
  }
  async function save(event) {
    event.preventDefault();
    if (busy || !changed || saved || mode === 'custom') return;
    setSaving(true);
    setMessage('');
    try {
      const response = await saveSchedule({
        enabled,
        mode,
        time,
        hours,
        version: schedule.version,
      });
      if (!response.ok) {
        const result = await response.json();
        const conflict =
          result.error === 'generation_running'
            ? 'admin.generationRunning'
            : 'admin.scheduleConflict';
        setMessage(response.status === 409 ? conflict : 'admin.saveFailed');
        return;
      }
      setSaved(true);
      toast.success(t('admin.saved'));
      await reload();
    } catch {
      setMessage('admin.saveFailed');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="admin-schedule" onSubmit={save} aria-busy={saving}>
      <div className="admin-toggle">
        <div>
          <Label htmlFor="admin-timer">{t('admin.timerLabel')}</Label>
          <p>{t(enabled ? 'admin.timerEnabled' : 'admin.timerDisabled')}</p>
        </div>
        <Switch
          id="admin-timer"
          checked={enabled}
          onCheckedChange={(value) => edit(setEnabled, value)}
          disabled={busy || mode === 'custom'}
        />
      </div>
      <div className="admin-fields">
        <div className="admin-field">
          <Label htmlFor="admin-frequency">{t('admin.frequency')}</Label>
          <Select
            id="admin-frequency"
            value={mode}
            options={[
              ...(schedule.mode === 'custom'
                ? [{ value: 'custom', label: t('admin.customFrequency'), disabled: true }]
                : []),
              { value: 'daily', label: t('admin.daily') },
              { value: 'hourly', label: t('admin.hourly') },
            ]}
            onValueChange={(value) => edit(setMode, value)}
            disabled={busy}
          />
        </div>
        {mode === 'daily' ? (
          <div className="admin-field">
            <Label htmlFor="admin-time">{t('admin.timeUTC')}</Label>
            <Input
              id="admin-time"
              type="time"
              required
              value={time}
              aria-describedby="admin-time-help"
              onChange={(event) => edit(setTime, event.target.value)}
              disabled={busy}
            />
          </div>
        ) : (
          mode === 'hourly' && (
            <div className="admin-field">
              <Label htmlFor="admin-interval">{t('admin.interval')}</Label>
              <Select
                id="admin-interval"
                value={String(hours)}
                options={[1, 2, 3, 4, 6, 8, 12].map((value) => ({
                  value: String(value),
                  label: t('admin.everyHours', { count: value }),
                }))}
                onValueChange={(value) => edit(setHours, Number(value))}
                disabled={busy}
              />
            </div>
          )
        )}
      </div>
      <p id="admin-time-help" className="admin-help admin-time-help">
        {t('admin.timeHelp')}
      </p>
      <div className="admin-current">
        <div>
          <span>{t('admin.currentSchedule')}</span>
          <strong>{summary}</strong>
        </div>
        <Badge variant="outline" className={schedule.enabled ? 'admin-badge-success' : ''}>
          {t(schedule.enabled ? 'admin.active' : 'admin.paused')}
        </Badge>
        <details className="admin-cron">
          <summary>{t('admin.viewCron')}</summary>
          <code>{schedule.cron}</code>
        </details>
      </div>
      {schedule.mode === 'custom' && <p className="admin-help">{t('admin.customSchedule')}</p>}
      {changed && (
        <Alert className="admin-save-notice" role="note">
          <Info aria-hidden="true" />
          <AlertDescription>{t('admin.restartHelp')}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="destructive" className="admin-save-error">
          <AlertDescription>{t(message)}</AlertDescription>
        </Alert>
      )}
      <div className="admin-form-actions">
        <Button type="submit" disabled={busy || !changed || saved || mode === 'custom'}>
          {saving ? <Spinner /> : <Save size={16} aria-hidden="true" />}
          {t(saving ? 'admin.saving' : 'admin.save')}
        </Button>
        {changed && !saved && (
          <Button variant="ghost" onClick={discard} disabled={busy}>
            {t('admin.discard')}
          </Button>
        )}
      </div>
    </form>
  );
}
