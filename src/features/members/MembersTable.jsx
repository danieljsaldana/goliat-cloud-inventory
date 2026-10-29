import { LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { Tooltip } from 'radix-ui';
import { useI18n } from '../../i18n/useI18n.js';
import { usePagination } from '../../components/ui/usePagination.js';
import Pagination from '../../components/ui/Pagination/index.jsx';
import { Badge } from '../../components/ui/primitives/badge.js';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/primitives/avatar.js';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../../components/ui/primitives/table.js';
import MemberPermissionAction from './MemberPermissionAction.jsx';

export default function MembersTable({ members, currentObjectId, resetKey, disabled, onSelect }) {
  const { t } = useI18n();
  const pagination = usePagination(members, 10, resetKey);
  return (
    <Tooltip.Provider delayDuration={150}>
      <Table className="members-table" containerClassName="members-table-frame">
        <colgroup>
          <col className="members-column-user" />
          <col className="members-column-role" />
          <col className="members-column-status" />
          <col className="members-column-actions" />
        </colgroup>
        <TableHeader>
          <TableRow>
            {['user', 'role', 'status', 'actions'].map((column) => (
              <TableHead key={column}>{t(`members.${column}`)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.items.map((user) => {
            const self = user.objectId === currentObjectId;
            return (
              <TableRow key={user.objectId}>
                <TableCell>
                  <div className="members-user">
                    <Avatar className="members-user-icon">
                      <AvatarImage
                        src={`/api/admin/members/${user.objectId}/photo/`}
                        alt={t('auth.userPhoto', { name: user.name })}
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="members-user-fallback">
                        <UserRound size={20} aria-hidden="true" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <strong>
                        {user.name}
                        {self && <span className="members-self">{t('members.you')}</span>}
                      </strong>
                      <span
                        className="members-user-address"
                        title={user.email || user.principalName}
                      >
                        {user.email || user.principalName}
                      </span>
                      <details className="members-identity">
                        <summary>{t('members.identity')}</summary>
                        <dl>
                          <div>
                            <dt>{t('members.identityObjectId')}</dt>
                            <dd>
                              <code>{user.objectId}</code>
                            </dd>
                          </div>
                          <div>
                            <dt>{t('members.identityPrincipal')}</dt>
                            <dd>{user.principalName}</dd>
                          </div>
                          <div>
                            <dt>{t('members.identityType')}</dt>
                            <dd>{t(`members.type.${user.type}`)}</dd>
                          </div>
                        </dl>
                      </details>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="members-roles">
                    <Badge variant={user.role === 'administrator' ? 'secondary' : 'outline'}>
                      {user.role === 'administrator' && (
                        <ShieldCheck size={13} aria-hidden="true" />
                      )}
                      {t(`members.role.${user.role}`)}
                    </Badge>
                    {user.protectedAdministrator && (
                      <Badge variant="secondary">
                        <LockKeyhole size={13} aria-hidden="true" />
                        {t('members.bootstrap')}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={user.enabled ? 'members-enabled' : ''}>
                    {t(user.enabled ? 'members.enabled' : 'members.disabled')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <MemberPermissionAction
                    user={user}
                    self={self}
                    disabled={disabled}
                    onSelect={onSelect}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {!members.length && (
            <TableRow>
              <TableCell colSpan={4} className="members-empty">
                {t('members.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pagination
        total={members.length}
        currentPage={pagination.currentPage}
        pageSize={pagination.pageSize}
        setPage={pagination.setPage}
        setPageSize={pagination.setPageSize}
        label={t('members.title')}
        pageSizes={[10, 25, 50]}
      />
    </Tooltip.Provider>
  );
}
