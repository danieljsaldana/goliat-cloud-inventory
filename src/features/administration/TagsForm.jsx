import { useMemo, useState } from 'react';
import { Info, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../i18n/useI18n.js';
import { validateTagKeys } from '../../core/inventory/tagKeys.js';
import { Alert, AlertDescription } from '../../components/ui/primitives/alert.js';
import { Button } from '../../components/ui/primitives/button.js';
import { Input } from '../../components/ui/primitives/input.js';
import { Label } from '../../components/ui/primitives/label.js';
import { Spinner } from '../../components/ui/primitives/spinner.js';
import { Switch } from '../../components/ui/primitives/switch.js';
import { saveTags } from './api/functionAdministration.js';
import Pagination from '../../components/ui/Pagination/index.jsx';
import { usePagination } from '../../components/ui/usePagination.js';

export default function TagsForm({ tags, available, reload, disabled = false }) {
  const { t, format } = useI18n();
  const [automatic, setAutomatic] = useState(!tags.keys.length);
  const [selected, setSelected] = useState(tags.keys);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const choices = useMemo(() => {
    const keys = new Map();
    for (const key of [...tags.keys, ...available])
      if (!keys.has(key.toLowerCase())) keys.set(key.toLowerCase(), key);
    return [...keys.values()].sort((a, b) => a.localeCompare(b));
  }, [tags.keys, available]);
  const visible = choices.filter((key) => key.toLowerCase().includes(query.trim().toLowerCase()));
  const pagination = usePagination(visible, 10, `${query}:${automatic}`);
  const changed =
    automatic !== !tags.keys.length ||
    (!automatic && JSON.stringify([...selected].sort()) !== JSON.stringify([...tags.keys].sort()));
  const busy = disabled || saving;
  const count = automatic ? choices.length : selected.length;
  function editSelection(keys) {
    setSelected(keys);
    setSaved(false);
    setMessage('');
  }
  function changeMode(value) {
    setAutomatic(value);
    editSelection(!value && !selected.length ? choices : selected);
  }
  function discard() {
    setAutomatic(!tags.keys.length);
    editSelection(tags.keys);
  }
  async function save(event) {
    event.preventDefault();
    if (busy || !changed || saved || (!automatic && !selected.length)) return;
    try {
      validateTagKeys(automatic ? [] : selected);
    } catch {
      setMessage('admin.tagsInvalidSelection');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await saveTags({ keys: automatic ? [] : selected, version: tags.version });
      if (!response.ok) {
        const result = await response.json();
        const conflict =
          result.error === 'generation_running' ? 'admin.generationRunning' : 'admin.tagsConflict';
        const failure =
          result.error === 'invalid_tags' ? 'admin.tagsInvalidSelection' : 'admin.tagsSaveFailed';
        setMessage(response.status === 409 ? conflict : failure);
        return;
      }
      setSaved(true);
      toast.success(t('admin.tagsSaved'), { description: t('admin.tagsApplyHelp') });
      await reload();
    } catch {
      setMessage('admin.tagsSaveFailed');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="admin-tags-form" onSubmit={save} aria-busy={saving}>
      <div className="admin-toggle">
        <div>
          <Label htmlFor="admin-tags-automatic">{t('admin.tagsAutomatic')}</Label>
          <p id="admin-tags-mode-help">
            {t(automatic ? 'admin.tagsAutomaticHelp' : 'admin.tagsSelectedHelp')}
          </p>
        </div>
        <Switch
          id="admin-tags-automatic"
          checked={automatic}
          onCheckedChange={changeMode}
          disabled={busy}
          aria-describedby="admin-tags-mode-help"
        />
      </div>
      <div className="admin-tags-toolbar">
        <div className="admin-tags-search">
          <Search size={17} aria-hidden="true" />
          <Input
            type="search"
            aria-label={t('admin.tagsSearch')}
            placeholder={t('admin.tagsSearch')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={busy}
          />
        </div>
        <span className="admin-help" role="status">
          {t(count === 1 ? 'admin.tagsCountOne' : 'admin.tagsCount', { count: format(count) })}
        </span>
        {!automatic && (
          <div className="admin-tags-selection">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editSelection(choices)}
              disabled={busy}
            >
              {t('admin.tagsSelectAll')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editSelection([])}
              disabled={busy || !selected.length}
            >
              {t('admin.tagsDeselectAll')}
            </Button>
          </div>
        )}
      </div>
      <fieldset className="admin-tags-options" disabled={busy || automatic}>
        <legend className="sr-only">{t('admin.tagsChoose')}</legend>
        {pagination.items.map((key) => (
          <label key={key} className="admin-tag-option">
            <input
              type="checkbox"
              checked={automatic || selected.includes(key)}
              onChange={(event) =>
                editSelection(
                  event.target.checked
                    ? [...selected, key]
                    : selected.filter((item) => item !== key),
                )
              }
            />
            <span>{key}</span>
          </label>
        ))}
      </fieldset>
      <Pagination total={visible.length} label={t('admin.tagsChoose')} {...pagination} />
      {!visible.length && (
        <p className="admin-help" role="status">
          {t(choices.length ? 'admin.tagsNoMatch' : 'admin.tagsEmpty')}
        </p>
      )}
      {!automatic && !selected.length && (
        <p className="admin-help" role="status">
          {t('admin.tagsChooseOne')}
        </p>
      )}
      <Alert className="admin-save-notice" role="note">
        <Info aria-hidden="true" />
        <AlertDescription>
          {t(changed ? 'admin.tagsRestartHelp' : 'admin.tagsApplyHelp')}
        </AlertDescription>
      </Alert>
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{t(message)}</AlertDescription>
        </Alert>
      )}
      <div className="admin-form-actions">
        <Button
          type="submit"
          disabled={busy || !changed || saved || (!automatic && !selected.length)}
        >
          {saving ? <Spinner /> : <Save size={16} aria-hidden="true" />}
          {t(saving ? 'admin.saving' : 'admin.tagsSave')}
        </Button>
        <Button type="button" variant="outline" disabled={busy || !changed} onClick={discard}>
          {t('admin.discard')}
        </Button>
      </div>
    </form>
  );
}
