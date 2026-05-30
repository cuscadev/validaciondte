import type { Metadata } from 'next';
import SeoInfoPage from '@/components/SeoInfoPage';

export const metadata: Metadata = {
  title: 'Auditoria DTE y control tributario',
  description:
    'Herramientas para auditoria DTE, revision de comprobantes electronicos y control tributario para empresas y despachos contables.',
  alternates: { canonical: '/auditoria-dte' },
};

export default function AuditoriaDtePage() {
  return (
    <SeoInfoPage
      eyebrow="Auditoria DTE"
      title="Auditoria de DTE para control tributario y revision contable"
      description="Kaiser DTE permite revisar lotes de documentos tributarios electronicos, extraer informacion importante y apoyar controles de auditoria fiscal."
      sections={[
        {
          title: 'Auditoria de comprobantes electronicos',
          body: 'Una auditoria DTE busca comprobar que los documentos electronicos esten completos, correctamente identificados y relacionados con operaciones reales de la empresa.',
        },
        {
          title: 'Revision por lotes',
          body: 'Cuando una empresa maneja muchos documentos, la revision manual se vuelve lenta. Una plataforma especializada ayuda a procesar archivos y localizar datos relevantes con mayor rapidez.',
        },
        {
          title: 'Control para cumplimiento',
          body: 'El control tributario requiere trazabilidad, busqueda de documentos y reportes claros. Kaiser DTE esta orientado a esos flujos para equipos contables y administrativos.',
        },
      ]}
      bullets={[
        'Apoyo para revision masiva de documentos.',
        'Datos ordenados para seguimiento contable.',
        'Mejor visibilidad para auditorias internas.',
      ]}
    />
  );
}
