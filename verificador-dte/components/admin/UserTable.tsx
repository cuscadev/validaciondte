import * as React from "react";
import Image from "next/image";
import { Ban, Eye, LogOut, MoreHorizontal, Pencil, Trash2, Unlock } from "lucide-react";

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
}

interface UserTableProps {
  rows: UserTableRow[];
  onEdit: (row: UserTableRow) => void;
  onDelete: (uid: string) => void;
  onViewDetails: (row: UserTableRow) => void;
  onForceLogout: (uid: string) => void;
  onToggleBlock: (row: UserTableRow) => void;
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UserTable({ rows, onEdit, onDelete, onViewDetails, onForceLogout, onToggleBlock }: UserTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[21%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="bg-slate-100 text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
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
        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-10 text-center text-muted-foreground">
                Sin usuarios
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.uid} className="transition hover:bg-slate-50 dark:hover:bg-black">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.photoURL ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-zinc-900">
                        <Image
                          src={row.photoURL}
                          alt={row.displayName || row.email}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-yellow-400 text-xs font-bold text-black dark:border-white/10">
                        {getInitials(row.displayName || row.email)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-950 dark:text-white">
                        {row.displayName || row.email}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-zinc-400">
                        {row.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-xs text-slate-500 dark:text-zinc-400">
                  {row.uid}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-zinc-900 dark:text-zinc-200">
                      {row.role}
                    </span>
                    {row.disabled && (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-200">
                        Bloqueado
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold capitalize text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-200">
                    {row.membershipType}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{row.membershipExpiresAt}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">
                  {row.role === "cliente"
                    ? `${row.collaboratorCount ?? 0} / ${row.maxCollaborators ?? 0}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" title="Mas acciones">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {row.role === "cliente" && (
                          <DropdownMenuItem onClick={() => onViewDetails(row)}>
                            <Eye className="size-4" />
                            Configurar delegados
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(row)}>
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
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
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
