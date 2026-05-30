// components/sidebar-items.ts
import {
  LayoutDashboard,
  UploadCloud,
  CheckCircle2,
  Settings,
  FileSearch,
} from "lucide-react";

// Para traducción, usar claves y pasar por t() en el componente
export const sidebarItems = [
  { name: "sidebar.inicio", href: "/dashboard", icon: LayoutDashboard },
  { name: "sidebar.consultarJSON", href: "/consultarjson", icon: FileSearch },
  { name: "sidebar.subirJSON", href: "/subir-json", icon: UploadCloud },
  { name: "sidebar.verificaciones", href: "/verificaciones", icon: CheckCircle2 },
  { name: "sidebar.configuracion", href: "/configuracion", icon: Settings },
];
