import * as React from "react";
import Image from "next/image";
import { Ban, BarChart3, Eye, LogOut, MoreHorizontal, Pencil, SlidersHorizontal, Trash2, Unlock } from "lucide-react";

import { TABLE_HEAD } from "@/lib/ui/table-classes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface UserTableRow {
  uid: string;
  email: string;
  role: string;
  membershipType: string;
  membershipExpiresAt: string;
  displayName?: string;
  photoURL?: string;
  cliente?: string;
  disabled?: boolean;
  organizationId?: string;
  collaboratorCount?: number;
  maxCollaborators?: number;
  limits?: {
    routeLimits?: Record<string, number | null>;
    mobileScanFolderLimit?: number | null;
  };
}

interface UserTableProps {
  rows: UserTableRow[];
  onEdit: (row: UserTableRow) => void;
  onDelete: (uid: string) => void;
  onViewDetails: (row: UserTableRow) => void;
  onViewStats?: (row: UserTableRow) => void;
  onEditLimits?: (row: UserTableRow) => void;
  onForceLogout: (uid: string) => void;
  onToggleBlock: (row: UserTableRow) => void;
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function UserAvatar({ row }: { row: UserTableRow }) {
  if (row.photoURL) {
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        <Image
          src={row.photoURL}
          alt={row.displayName || row.email}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary text-xs font-bold text-primary-foreground">
      {getInitials(row.displayName || row.email)}
    </div>
  );
}

function UserRoleBadges({ row }: { row: UserTableRow }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold capitalize text-muted-foreground">
        {row.role}
      </span>
      {row.disabled && (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-200">
          Bloqueado
        </span>
      )}
    </div>
  );
}

function UserTableActions({
  row,
  onEdit,
  onDelete,
  onViewDetails,
  onViewStats,
  onEditLimits,
  onForceLogout,
  onToggleBlock,
  align = "end",
}: UserTableProps & { row: UserTableRow; align?: "start" | "end" | "center" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" title="Mas acciones" className="shrink-0">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        {row.role === "cliente" && (
          <>
            <DropdownMenuItem onClick={() => onViewStats?.(row)}>
              <BarChart3 className="size-4" />
              Estadisticas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewDetails(row)}>
              <Eye className="size-4" />
              Configurar delegados
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={() => onEdit(row)}>
          <Pencil className="size-4" />
          Editar
        </DropdownMenuItem>
        {row.role !== "superadmin" && (
          <DropdownMenuItem onClick={() => onEditLimits?.(row)}>
            <SlidersHorizontal className="size-4" />
            Configurar limites
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onForceLogout(row.uid)}>
          <LogOut className="size-4" />
          Forzar cierre de sesion
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleBlock(row)}>
          {row.disabled ? <Unlock className="size-4" /> : <Ban className="size-4" />}
          {row.disabled ? "Desbloquear" : "Bloquear"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.uid)}>
          <Trash2 className="size-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserTableMobileCard(props: UserTableProps & { row: UserTableRow }) {
  const { row } = props;

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar row={row} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {row.displayName || row.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
            </div>
            <UserTableActions {...props} row={row} align="end" />
          </div>
          <div className="mt-3 space-y-3">
            <UserRoleBadges row={row} />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
              <dt className="font-medium text-muted-foreground">Membresia</dt>
              <dd>
                <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold capitalize text-primary">
                  {row.membershipType}
                </span>
              </dd>
              <dt className="font-medium text-muted-foreground">Expira</dt>
              <dd className="text-foreground">{row.membershipExpiresAt || "—"}</dd>
              {row.role === "cliente" ? (
                <>
                  <dt className="font-medium text-muted-foreground">Delegados</dt>
                  <dd className="text-foreground">
                    {row.collaboratorCount ?? 0} / {row.maxCollaborators ?? 0}
                  </dd>
                </>
              ) : null}
              <dt className="self-start font-medium text-muted-foreground">UID</dt>
              <dd className="break-all font-mono text-[11px] leading-5 text-muted-foreground">
                {row.uid}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </article>
  );
}

export function UserTable({
  rows,
  onEdit,
  onDelete,
  onViewDetails,
  onViewStats,
  onEditLimits,
  onForceLogout,
  onToggleBlock,
}: UserTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
        Sin usuarios
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <UserTableMobileCard
            key={row.uid}
            row={row}
            rows={rows}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewDetails={onViewDetails}
            onViewStats={onViewStats}
            onEditLimits={onEditLimits}
            onForceLogout={onForceLogout}
            onToggleBlock={onToggleBlock}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Usuario</th>
              <th className="px-4 py-3 text-left font-semibold">UID</th>
              <th className="px-4 py-3 text-left font-semibold">Rol</th>
              <th className="px-4 py-3 text-left font-semibold">Membresia</th>
              <th className="px-4 py-3 text-left font-semibold">Expira</th>
              <th className="px-4 py-3 text-left font-semibold">Delegados</th>
              <th className="px-4 py-3 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.uid} className="transition hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar row={row} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">
                        {row.displayName || row.email}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                  {row.uid}
                </td>
                <td className="px-4 py-3">
                  <UserRoleBadges row={row} />
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold capitalize text-primary">
                    {row.membershipType}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.membershipExpiresAt}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.role === "cliente"
                    ? `${row.collaboratorCount ?? 0} / ${row.maxCollaborators ?? 0}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <UserTableActions
                      row={row}
                      rows={rows}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onViewDetails={onViewDetails}
                      onViewStats={onViewStats}
                      onEditLimits={onEditLimits}
                      onForceLogout={onForceLogout}
                      onToggleBlock={onToggleBlock}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
