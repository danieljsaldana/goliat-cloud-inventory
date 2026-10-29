import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Button } from '../../components/ui/primitives/button.js';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/primitives/sheet.js';
import { updateMemberRole } from './api/members.js';

const errors = new Set([
  'role_conflict',
  'member_disabled',
  'protected_administrator',
  'self_role_change',
  'administrator_required',
  'directory_forbidden',
]);

export default function MemberRoleSheet({ selection, onClose, onSaved }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const granting = selection?.role === 'member';
  async function save() {
    setSaving(true);
    setError('');
    try {
      await updateMemberRole({
        objectId: selection.objectId,
        role: granting ? 'administrator' : 'member',
        expectedRole: selection.role,
      });
      await onSaved();
    } catch (failure) {
      setError(
        errors.has(failure.message) ? `members.error.${failure.message}` : 'members.saveFailed',
      );
    } finally {
      setSaving(false);
    }
  }
  function close(open) {
    if (!open && !saving) {
      setError('');
      onClose();
    }
  }
  return (
    <Sheet open={Boolean(selection)} onOpenChange={close}>
      <SheetContent
        className="members-role-sheet"
        showCloseButton={!saving}
        closeLabel={t('members.cancel')}
      >
        <span className="members-sheet-icon">
          <ShieldCheck size={24} aria-hidden="true" />
        </span>
        <SheetTitle>{t(granting ? 'members.confirmGrant' : 'members.confirmRevoke')}</SheetTitle>
        <SheetDescription>
          {t(granting ? 'members.grantHelp' : 'members.revokeHelp')}
        </SheetDescription>
        {selection && (
          <div className="members-selected">
            <strong>{selection.name}</strong>
            <span>{selection.email || selection.principalName}</span>
            <code>{selection.objectId}</code>
          </div>
        )}
        <p className="members-scope-note">{t('members.scopeHelp')}</p>
        {error && (
          <p role="alert" className="members-save-error">
            {t(error)}
          </p>
        )}
        <div className="members-sheet-actions">
          <Button disabled={saving} onClick={() => void save()}>
            {t(saving ? 'members.saving' : 'members.confirm')}
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => close(false)}>
            {t('members.cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
