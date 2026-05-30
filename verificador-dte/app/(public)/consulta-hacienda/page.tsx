import type { Metadata } from 'next';
import SeoInfoPage from '@/components/SeoInfoPage';

export const metadata: Metadata = {
  title: 'Consulta DTE con Hacienda',
  description:
    'Consulta y valida informacion de DTE relacionada con Hacienda El Salvador usando codigo de generacion y fecha de emision.',
  alternates: { canonical: '/consulta-hacienda' },
};

export default function ConsultaHaciendaPage() {
  return (
    <SeoInfoPage
      eyebrow="Consulta Hacienda"
      title="Consulta de DTE con Hacienda para validacion tributaria"
      description="Kaiser DTE facilita flujos de consulta y control de documentos tributarios electronicos vinculados a Hacienda, usando datos como codigo de generacion, ambiente y fecha de emision."
      sections={[
        {
          title: 'Datos necesarios para consultar',
          body: 'La consulta de un DTE normalmente requiere codigo de generacion, fecha de emision y ambiente del documento. Estos datos permiten construir enlaces de validacion y revisar informacion fiscal.',
        },
        {
          title: 'Validacion de comprobantes',
          body: 'La plataforma ayuda a ordenar resultados de consulta para que el usuario pueda comparar informacion del documento con datos relevantes de emisor, receptor, tipo de DTE y totales.',
        },
        {
          title: 'Uso en auditoria',
          body: 'Los equipos de auditoria pueden apoyarse en consultas y reportes para identificar documentos pendientes de revision o comprobantes que requieren seguimiento.',
        },
      ]}
      bullets={[
        'Enlaces y QR de consulta para documentos DTE.',
        'Revision de codigos de generacion y fechas.',
        'Control de consultas para equipos contables.',
      ]}
    />
  );
}
