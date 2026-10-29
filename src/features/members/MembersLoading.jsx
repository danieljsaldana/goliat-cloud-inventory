import { Card, CardContent, CardHeader } from '../../components/ui/primitives/card.js';
import { Skeleton } from '../../components/ui/primitives/skeleton.js';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../../components/ui/primitives/table.js';

export default function MembersLoading() {
  return (
    <div className="members-loading" aria-hidden="true">
      <div className="members-summary">
        {[0, 1, 2].map((index) => (
          <Card key={index}>
            <CardContent>
              <Skeleton className="members-skeleton-caption" />
              <Skeleton className="members-skeleton-value" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="members-directory">
        <CardHeader>
          <Skeleton className="members-skeleton-title" />
          <Skeleton className="members-skeleton-caption" />
          <Skeleton className="members-skeleton-tenant" />
        </CardHeader>
        <CardContent>
          <div className="members-filters">
            {[0, 1].map((index) => (
              <div key={index}>
                <Skeleton className="members-skeleton-label" />
                <Skeleton className="members-skeleton-control" />
              </div>
            ))}
          </div>
          <Table className="members-table" containerClassName="members-table-frame">
            <colgroup>
              <col className="members-column-user" />
              <col className="members-column-role" />
              <col className="members-column-status" />
              <col className="members-column-actions" />
            </colgroup>
            <TableHeader>
              <TableRow>
                {[0, 1, 2, 3].map((index) => (
                  <TableHead key={index}>
                    <Skeleton className="members-skeleton-label" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="members-skeleton-user-row">
                      <Skeleton className="members-skeleton-avatar" />
                      <div className="members-skeleton-user">
                        <Skeleton className="members-skeleton-label" />
                        <Skeleton className="members-skeleton-caption" />
                        <Skeleton className="members-skeleton-label" />
                      </div>
                    </div>
                  </TableCell>
                  {[0, 1, 2].map((column) => (
                    <TableCell key={column}>
                      <Skeleton className="members-skeleton-label" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="members-loading-footer">
            <Skeleton className="members-skeleton-label" />
            <Skeleton className="members-skeleton-page" />
            <Skeleton className="members-skeleton-label" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
