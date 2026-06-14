import * as React from "react";
import { Save, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface UserFormProps {
  form: any;
  editMode: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onMembershipTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onMembershipExpiresChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10";

export function UserForm({
  form,
  editMode,
  onChange,
  onMembershipTypeChange,
  onMembershipExpiresChange,
  onSubmit,
  onCancel,
}: UserFormProps) {
  return (
    <form onSubmit={onSubmit} className="w-full min-w-[340px] max-w-lg">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-md bg-primary text-black">
          {editMode ? <Save className="size-5" /> : <UserPlus className="size-5" />}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {editMode ? "Editar usuario" : "Crear usuario"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define rol, membresia y vigencia del acceso.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-zinc-200">
          UID
          <input
            name="uid"
            placeholder="UID del usuario"
            value={form.uid || ""}
            onChange={onChange}
            className={fieldClass}
            required
            disabled={!!editMode}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-zinc-200">
          Email
          <input
            name="email"
            type="email"
            placeholder="correo@ejemplo.com"
            value={form.email || ""}
            onChange={onChange}
            className={fieldClass}
            required
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-zinc-200">
          Rol
          <select
            name="role"
            value={form.role || ""}
            onChange={onChange}
            className={fieldClass}
            required
          >
            <option value="">Seleccionar rol</option>
            <option value="superadmin">Super Admin</option>
            <option value="cliente">Cliente</option>
            <option value="colaborador">Colaborador</option>
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-zinc-200">
            Membresia
            <select
              name="membership.type"
              value={form.membership?.type || ""}
              onChange={onMembershipTypeChange}
              className={fieldClass}
              required
            >
              <option value="">Tipo</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
              <option value="pro">Pro</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-zinc-200">
            Vence
            <input
              name="membership.expiresAt"
              type="date"
              value={form.membership?.expiresAt || ""}
              onChange={onMembershipExpiresChange}
              className={fieldClass}
            />
          </label>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="size-4" />
          Cancelar
        </Button>
        <Button type="submit" className="bg-primary font-bold text-black hover:bg-primary/90">
          <Save className="size-4" />
          {editMode ? "Guardar cambios" : "Crear usuario"}
        </Button>
      </div>
    </form>
  );
}
