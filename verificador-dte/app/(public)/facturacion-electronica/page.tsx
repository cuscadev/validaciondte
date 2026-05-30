import type { Metadata } from 'next';
import SeoInfoPage from '@/components/SeoInfoPage';

export const metadata: Metadata = {
  title: 'Facturacion electronica en El Salvador',
  description:
    'Herramienta para gestionar y revisar documentos de facturacion electronica en El Salvador con enfoque en DTE, control y auditoria.',
  alternates: { canonical: '/facturacion-electronica' },
};

export default function FacturacionElectronicaPage() {
  return (
    <SeoInfoPage
      eyebrow="Facturacion electronica"
      title="Gestion de facturacion electronica y DTE en El Salvador"
      description="Centraliza procesos relacionados con documentos tributarios electronicos para revisar comprobantes, validar informacion y mantener control operativo sobre la facturacion electronica."
      sections={[
        {
          title: 'Documentos tributarios electronicos',
          body: 'Los DTE forman parte del flujo de facturacion electronica en El Salvador. Su revision requiere controlar codigos, fechas, montos, emisores, receptores y detalles fiscales.',
        },
        {
          title: 'Control para empresas',
          body: 'Las empresas pueden usar Kaiser DTE para ordenar informacion recibida, verificar comprobantes y apoyar procesos internos de contabilidad, compras, ventas y cumplimiento.',
        },
        {
          title: 'Apoyo para despachos contables',
          body: 'Los despachos contables pueden reducir tareas repetitivas al procesar documentos, extraer datos relevantes y mantener una revision mas clara de comprobantes electronicos.',
        },
      ]}
      bullets={[
        'Organizacion de comprobantes electronicos.',
        'Revision de compras, ventas y documentos relacionados.',
        'Flujos pensados para contabilidad y cumplimiento fiscal.',
      ]}
    />
  );
}
