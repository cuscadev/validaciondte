import type { Metadata } from 'next';
import SeoInfoPage from '@/components/SeoInfoPage';

export const metadata: Metadata = {
  title: 'Verificacion DTE en El Salvador',
  description:
    'Sistema para verificar DTE en El Salvador, consultar documentos tributarios electronicos y revisar informacion fiscal de comprobantes.',
  alternates: { canonical: '/verificacion-dte' },
};

export default function VerificacionDtePage() {
  return (
    <SeoInfoPage
      eyebrow="Verificacion DTE"
      title="Verificador de DTE en El Salvador para empresas y contadores"
      description="Kaiser DTE ayuda a revisar documentos tributarios electronicos, validar datos importantes y ordenar consultas fiscales para equipos contables, empresas y auditorias."
      sections={[
        {
          title: 'Que es la verificacion de DTE',
          body: 'La verificacion de DTE permite revisar datos de documentos tributarios electronicos como codigo de generacion, fecha de emision, emisor, receptor, totales y estado relacionado con Hacienda.',
        },
        {
          title: 'Como verificar un DTE',
          body: 'Un usuario puede cargar informacion del documento, consultar datos clave y organizar resultados para comprobar si un comprobante electronico corresponde con la informacion fiscal esperada.',
        },
        {
          title: 'Para quien sirve',
          body: 'Es util para despachos contables, empresas que reciben muchos comprobantes, responsables de auditoria tributaria y equipos que necesitan controlar documentos electronicos de forma repetible.',
        },
      ]}
      bullets={[
        'Consulta y organiza DTE desde una plataforma web.',
        'Reduce revision manual de codigos y comprobantes.',
        'Apoya controles fiscales internos y auditorias.',
      ]}
    />
  );
}
