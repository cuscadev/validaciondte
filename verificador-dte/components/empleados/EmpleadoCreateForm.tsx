"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EmpleadoCreateForm({ cliente }: { cliente: string }) {
  const [nombre, setNombre] = useState("");
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, cliente }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear empleado");
      setResult(data);
      setNombre("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <Input
        placeholder="Nombre del empleado"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading || !nombre}>
        {loading ? "Creando..." : "Crear empleado"}
      </Button>
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      {result && (
        <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded">
          <div className="font-semibold mb-2">Datos de acceso del empleado:</div>
          <div><span className="font-medium">Usuario:</span> {result.email}</div>
          <div><span className="font-medium">Contraseña:</span> {result.password}</div>
          <div className="text-xs text-zinc-500 mt-2">Copia estos datos y entrégaselos al empleado. No se mostrarán de nuevo.</div>
        </div>
      )}
    </form>
  );
}
