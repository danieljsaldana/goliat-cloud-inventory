import { useState } from 'react';
import { CircleAlert, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { useAsyncResource } from '../../hooks/useAsyncResource.js';
import { Button } from '../../components/ui/primitives/button.js';
import { Input } from '../../components/ui/primitives/input.js';
import { Label } from '../../components/ui/primitives/label.js';
import { Alert, AlertDescription } from '../../components/ui/primitives/alert.js';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/primitives/card.js';
import Select from '../../components/ui/Select/index.jsx';
import { loadMembers } from './api/members.js';
import MembersTable from './MembersTable.jsx';
import MembersLoading from './MembersLoading.jsx';
import MemberRoleSheet from './MemberRoleSheet.jsx';
import './MembersPage.css';

export default function MembersPage() {
  const { t, format } = useI18n();
  const { data, loading, error, reload } = useAsyncResource(loadMembers, { preserveData: true });
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [selection, setSelection] = useState(null);
  const [notice, setNotice] = useState('');
  const users = data?.members || [];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = users.filter(
    (user) =>
      (role === 'all' || user.role === role) &&
      [user.name, user.email, user.principalName, user.objectId].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      ),
  );
  const summary = [
    { label: 'members.accounts', value: users.length },
    {
      label: 'members.administrators',
      value: users.filter((user) => user.role === 'administrator').length,
    },
    { label: 'members.enabledAccounts', value: users.filter((user) => user.enabled).length },
  ];
  async function saved() {
    setSelection(null);
    setNotice('members.saved');
    const result = await reload();
    if (!result.ok) setNotice('members.savedRefreshFailed');
  }
  return (
    <main id="main" tabIndex={-1} className="members-page">
      <div className="members-heading">
        <div>
          <p className="members-eyebrow">
            <Users size={16} aria-hidden="true" />
            {t('members.eyebrow')}
          </p>
          <h1>{t('members.title')}</h1>
          <p>{t('members.description')}</p>
        </div>
        <Button
          variant="outline"
          disabled={loading || Boolean(selection)}
          aria-busy={loading}
          onClick={() => {
            setNotice('');
            void reload();
          }}
        >
          <RefreshCw size={16} className={loading ? 'members-spinning' : ''} aria-hidden="true" />
          {t(loading ? 'members.loading' : 'members.refresh')}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="members-feedback">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t('members.loadFailed')}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <p className="members-notice" role="status">
          {t(notice)}
        </p>
      )}
      {!data && loading && <MembersLoading />}
      {data && (
        <>
          <div className="members-summary">
            {summary.map(({ label, value }) => (
              <Card key={label}>
                <CardContent>
                  <p>{t(label)}</p>
                  <strong>{format(value)}</strong>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="members-directory">
            <CardHeader>
              <CardTitle as="h2">
                <ShieldCheck size={20} aria-hidden="true" />
                {t('members.directory')}
              </CardTitle>
              <CardDescription>{t('members.accessHelp')}</CardDescription>
              <p className="members-tenant">
                {t('members.tenant')}
                <code>{data.tenantId}</code>
              </p>
            </CardHeader>
            <CardContent>
              <div className="members-filters">
                <div>
                  <Label htmlFor="members-search">{t('members.search')}</Label>
                  <div className="members-search">
                    <Search size={18} aria-hidden="true" />
                    <Input
                      id="members-search"
                      type="search"
                      value={query}
                      placeholder={t('members.searchPlaceholder')}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                </div>
                <div className="members-role-filter">
                  <Label htmlFor="members-role">{t('members.role')}</Label>
                  <Select
                    id="members-role"
                    value={role}
                    onValueChange={setRole}
                    options={['all', 'member', 'administrator'].map((value) => ({
                      value,
                      label: t(`members.role.${value}`),
                    }))}
                  />
                </div>
              </div>
              <MembersTable
                members={filtered}
                currentObjectId={data.currentObjectId}
                resetKey={`${query}:${role}`}
                disabled={loading}
                onSelect={setSelection}
              />
            </CardContent>
          </Card>
          <p className="members-scope-note">{t('members.scopeHelp')}</p>
        </>
      )}
      <MemberRoleSheet selection={selection} onClose={() => setSelection(null)} onSaved={saved} />
    </main>
  );
}
