'use client';

import { Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getOrgRoleLabel } from '@/lib/org-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type OrgMembersDetail = {
  organization: {
    id: string;
    displayTitle?: string;
    displaySubtitle?: string | null;
    allowedEmailDomain?: string;
    collaboratorCount?: number;
    maxCollaborators?: number;
    limits?: {
      routeLimits?: Record<string, number | null>;
      mobileScanFolderLimit?: number | null;
    };
  };
  owner: {
    uid: string;
    email: string;
    displayName: string;
  } | null;
  collaborators: {
    uid: string;
    email: string;
    displayName: string;
    orgRole?: string;
    accountStatus?: string;
  }[];
};

type OrgMembersPanelProps = {
  loading: boolean;
  detail: OrgMembersDetail | null;
  onEditMember?: (uid: string) => void;
};

export function OrgMembersPanel({ loading, detail, onEditMember }: OrgMembersPanelProps) {
  if (loading || !detail) {
    return (
      <div className="flex justify-center border-t border-slate-200 bg-slate-50/80 py-10 dark:border-white/10 dark:bg-black/40">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const org = detail.organization;

  return (
    <div className="space-y-6 border-t border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-black/40 md:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Usuarios de la organización
        </p>
        {typeof org.collaboratorCount === 'number' && (
          <p className="mt-1 text-sm text-muted-foreground">
            Delegados: {org.collaboratorCount} / {org.maxCollaborators ?? '—'}
            {org.allowedEmailDomain ? ` · @${org.allowedEmailDomain}` : ''}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Cuenta titular</h3>
          <p className="text-sm text-muted-foreground">
            Persona que contrata la membresía y administra la organización
          </p>
        </div>
        {detail.owner ? (
          <div className="overflow-hidden rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Función</TableHead>
                  {onEditMember ? <TableHead className="text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{detail.owner.displayName || '—'}</TableCell>
                  <TableCell>{detail.owner.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getOrgRoleLabel('cliente')}</Badge>
                  </TableCell>
                  {onEditMember ? (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditMember(detail.owner!.uid)}
                      >
                        <Pencil className="mr-1 size-3" />
                        Editar
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Titular no encontrado.</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Personas delegadas</h3>
          <p className="text-sm text-muted-foreground">
            Usuarios que realizan verificaciones en nombre del titular
          </p>
        </div>
        {detail.collaborators.length === 0 ? (
          <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
            Sin personas delegadas registradas.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Función</TableHead>
                  <TableHead>Estado</TableHead>
                  {onEditMember ? <TableHead className="text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.collaborators.map((col) => (
                  <TableRow key={col.uid}>
                    <TableCell>{col.displayName || '—'}</TableCell>
                    <TableCell>{col.email}</TableCell>
                    <TableCell>{getOrgRoleLabel('colaborador', col.orgRole)}</TableCell>
                    <TableCell className="capitalize">{col.accountStatus ?? 'active'}</TableCell>
                    {onEditMember ? (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditMember(col.uid)}
                        >
                          <Pencil className="mr-1 size-3" />
                          Editar
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
