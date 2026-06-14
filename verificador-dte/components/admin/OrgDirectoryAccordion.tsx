'use client';

import type { ReactNode } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import type { PersonType } from '@/lib/organization-types';
import {
  getOrgDirectorySegmentFromDisplay,
  getOrgDirectorySegmentLabel,
} from '@/lib/org-display';
import { OrgMembersPanel, type OrgMembersDetail } from '@/components/admin/OrgMembersPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type OrgDirectoryRow = {
  organizationId: string;
  ownerUid: string;
  ownerEmail: string;
  ownerDisplayName?: string;
  organization: {
    name: string;
    displayTitle?: string;
    displaySubtitle?: string | null;
    personType?: PersonType | null;
    groupName?: string | null;
    legalName?: string | null;
    allowedEmailDomain: string;
    membershipType: string;
    maxCollaborators: number;
    collaboratorCount: number;
    status: string;
    kycCompleted: boolean;
  } | null;
};

type OrgDirectoryAccordionProps = {
  rows: OrgDirectoryRow[];
  expandedOrgId: string | null;
  expandingOrgId: string | null;
  expandedDetail: OrgMembersDetail | null;
  onToggle: (organizationId: string) => void;
  onEditMember?: (uid: string) => void;
};

const ACCORDION_ROW_LAYOUT =
  'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,7.5rem)_minmax(0,1.25fr)_minmax(0,4.5rem)_minmax(0,5.5rem)_minmax(0,4.5rem)_2.5rem] md:items-center md:gap-4';

const ORPHAN_BADGE_CLASS =
  'border-slate-400/40 bg-slate-500/10 text-muted-foreground';

function AccordionColumnHeaders() {
  return (
    <div
      role="row"
      className={cn(
        'hidden border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400',
        ACCORDION_ROW_LAYOUT
      )}
    >
      <span role="columnheader">Organización</span>
      <span role="columnheader">Tipo</span>
      <span role="columnheader">Titular</span>
      <span role="columnheader">Delegados</span>
      <span role="columnheader">KYC</span>
      <span role="columnheader">Estado</span>
      <span className="sr-only" role="columnheader">
        Detalle
      </span>
    </div>
  );
}

function segmentBadgeClass(segment: ReturnType<typeof getOrgDirectorySegmentFromDisplay>) {
  switch (segment) {
    case 'juridica':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200';
    case 'natural_with_group':
      return 'border-brand-orange/40 bg-brand-orange/10 text-primary dark:text-primary';
    default:
      return 'border-slate-500/30 bg-slate-500/10 text-slate-800 dark:text-slate-200';
  }
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:sr-only">
      {children}
    </p>
  );
}

function OrgDirectoryRowCells({ row }: { row: OrgDirectoryRow }) {
  const org = row.organization;
  const hasOrg = org != null;

  if (!hasOrg) {
    return (
      <>
        <div className="min-w-0">
          <FieldLabel>Organización</FieldLabel>
          <p className="font-medium text-muted-foreground">Sin organización</p>
        </div>

        <div>
          <FieldLabel>Tipo</FieldLabel>
          <Badge variant="outline" className={cn('mt-0.5 w-fit md:mt-0', ORPHAN_BADGE_CLASS)}>
            Sin organización
          </Badge>
        </div>

        <div className="min-w-0">
          <FieldLabel>Titular</FieldLabel>
          <p className="font-medium">{row.ownerDisplayName || row.ownerEmail}</p>
          <p className="text-xs text-muted-foreground">{row.ownerEmail}</p>
        </div>

        <div>
          <FieldLabel>Delegados</FieldLabel>
          <p className="text-sm text-muted-foreground">—</p>
        </div>

        <div>
          <FieldLabel>KYC</FieldLabel>
          <Badge variant="outline" className="mt-0.5 w-fit md:mt-0">
            Pendiente
          </Badge>
        </div>

        <div>
          <FieldLabel>Estado</FieldLabel>
          <p className="text-sm text-muted-foreground">—</p>
        </div>
      </>
    );
  }

  const segment = getOrgDirectorySegmentFromDisplay({
    personType: org.personType,
    groupName: org.groupName,
    legalName: org.legalName,
  });

  return (
    <>
      <div className="min-w-0">
        <FieldLabel>Organización</FieldLabel>
        <p className="font-medium">{org.displayTitle || org.name || '—'}</p>
        {org.displaySubtitle ? (
          <p className="text-xs text-muted-foreground">{org.displaySubtitle}</p>
        ) : null}
        {org.allowedEmailDomain ? (
          <p className="text-xs text-muted-foreground">@{org.allowedEmailDomain}</p>
        ) : null}
      </div>

      <div>
        <FieldLabel>Tipo</FieldLabel>
        <Badge
          variant="outline"
          className={cn('mt-0.5 w-fit md:mt-0', segmentBadgeClass(segment))}
        >
          {getOrgDirectorySegmentLabel(segment)}
        </Badge>
      </div>

      <div className="min-w-0">
        <FieldLabel>Titular</FieldLabel>
        <p className="font-medium">{row.ownerDisplayName || row.ownerEmail}</p>
        <p className="text-xs text-muted-foreground">{row.ownerEmail}</p>
      </div>

      <div>
        <FieldLabel>Delegados</FieldLabel>
        <p className="text-sm text-muted-foreground">
          {org.collaboratorCount} / {org.maxCollaborators}
        </p>
      </div>

      <div>
        <FieldLabel>KYC</FieldLabel>
        {org.kycCompleted ? (
          <Badge className="mt-0.5 w-fit bg-green-600 md:mt-0">Completo</Badge>
        ) : (
          <Badge variant="outline" className="mt-0.5 w-fit md:mt-0">
            Pendiente
          </Badge>
        )}
      </div>

      <div>
        <FieldLabel>Estado</FieldLabel>
        <p className="text-sm capitalize text-muted-foreground">{org.status}</p>
      </div>
    </>
  );
}

export function OrgDirectoryAccordion({
  rows,
  expandedOrgId,
  expandingOrgId,
  expandedDetail,
  onToggle,
  onEditMember,
}: OrgDirectoryAccordionProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-muted-foreground dark:border-white/10 dark:bg-black">
        No hay organizaciones que coincidan con la búsqueda.
      </div>
    );
  }

  return (
    <div
      role="table"
      aria-label="Directorio de organizaciones"
      className="overflow-hidden rounded-lg border border-border"
    >
      <AccordionColumnHeaders />
      <div className="divide-y divide-slate-200 dark:divide-white/10">
        {rows.map((row) => {
          const org = row.organization;
          const hasOrg = org != null;
          const isExpanded = hasOrg && expandedOrgId === row.organizationId;
          const isLoading = hasOrg && expandingOrgId === row.organizationId;

          return (
            <div
              key={row.organizationId}
              role="row"
              className={cn(
                'overflow-hidden bg-background',
                isExpanded && 'bg-primary/[0.03] ring-1 ring-inset ring-primary/25'
              )}
            >
              {hasOrg ? (
                <button
                  type="button"
                  onClick={() => onToggle(row.organizationId)}
                  className={cn(
                    'flex w-full flex-col gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-900/50',
                    ACCORDION_ROW_LAYOUT
                  )}
                  aria-expanded={isExpanded}
                >
                  <OrgDirectoryRowCells row={row} />
                  <ChevronDown
                    className={cn(
                      'size-5 shrink-0 text-muted-foreground transition-transform md:justify-self-end',
                      isExpanded && 'rotate-180'
                    )}
                    aria-hidden
                  />
                </button>
              ) : (
                <div
                  className={cn(
                    'flex w-full flex-col gap-3 p-4',
                    ACCORDION_ROW_LAYOUT
                  )}
                >
                  <OrgDirectoryRowCells row={row} />
                  <div className="flex md:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      aria-label={`Editar usuario ${row.ownerDisplayName || row.ownerEmail}`}
                      onClick={() => onEditMember?.(row.ownerUid)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Editar
                    </Button>
                  </div>
                </div>
              )}

              {hasOrg && isExpanded && (
                <OrgMembersPanel
                  loading={isLoading}
                  detail={expandedDetail}
                  onEditMember={onEditMember}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
