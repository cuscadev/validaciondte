import type { ProductTourDefinition } from '@/lib/product-tours/registry';
import {
  buildCustomVerifierTour,
  buildUploadFormVerifierTour,
  uploadVerifierResultsSteps,
  UPLOAD_VERIFIER_SELECTORS,
} from '@/lib/product-tours/tours/upload-verifier-tour';

export const VERIFICADOR_LINKS_TOUR_ID = 'verificador-links';
export const VERIFICADOR_CODIGO_FECHA_TOUR_ID = 'verificador-codigo-fecha';
export const VERIFICADOR_JSON_TOUR_ID = 'verificador-json';
export const VERIFICADOR_INDIVIDUAL_TOUR_ID = 'verificador-individual';
export const VERIFICADOR_QR_TOUR_ID = 'verificador-qr';

function uploadTour(
  id: string,
  pathname: string,
  label: string,
  copy: Parameters<typeof buildUploadFormVerifierTour>[0],
): ProductTourDefinition {
  return {
    id,
    pathname,
    label,
    steps: buildUploadFormVerifierTour(copy),
    deferredSteps: uploadVerifierResultsSteps,
  };
}

export const VERIFICADOR_TOURS: ProductTourDefinition[] = [
  uploadTour(VERIFICADOR_LINKS_TOUR_ID, '/verificadorDTE/verificador', 'Verificador de links', {
    intro: {
      title: '¡Hola! Te ayudamos a verificar tus DTEs',
      description:
        'En unos pasos te mostramos cómo subir tu archivo, validarlo con Hacienda y descargar los resultados. Puedes cerrar esta guía cuando quieras.',
    },
    upload: {
      title: 'Paso 1: Sube tu archivo',
      description:
        'Arrastra tu archivo aquí o haz clic para buscarlo. Puede ser Excel o CSV con los enlaces de consulta de Hacienda.',
    },
    template: {
      title: 'Paso 2: ¿No tienes el formato?',
      description:
        'No te preocupes. Descarga nuestra plantilla de ejemplo y solo copia tus enlaces. Así evitas errores al cargar.',
    },
    submit: {
      title: 'Paso 3: ¡A procesar!',
      description:
        'Cuando ya tengas tu archivo listo, pulsa Procesar. Nosotros validamos cada DTE por ti. Al terminar, te enseñamos cómo descargar y revisar todo.',
      doneBtnText: '¡Vamos!',
    },
  }),
  uploadTour(
    VERIFICADOR_CODIGO_FECHA_TOUR_ID,
    '/verificadorDTE/verificarodyfecha',
    'Verificar código y fecha',
    {
      intro: {
        title: 'Verifica por código y fecha',
        description:
          'Aquí puedes validar muchos DTEs a la vez usando el código de generación y la fecha de emisión. Te guiamos paso a paso.',
      },
      upload: {
        title: 'Paso 1: Sube tu archivo',
        description:
          'Usa Excel, CSV o TXT con el código en la columna A y la fecha en la columna B. Arrastra el archivo o búscalo en tu equipo.',
      },
      template: {
        title: 'Paso 2: Descarga la plantilla',
        description:
          'Si prefieres empezar con el formato correcto, descarga la plantilla y solo completa tus códigos y fechas.',
      },
      submit: {
        title: 'Paso 3: ¡A validar!',
        description:
          'Pulsa Procesar cuando tu archivo esté listo. Al terminar te mostramos cómo exportar y revisar los resultados.',
        doneBtnText: '¡Vamos!',
      },
    },
  ),
  uploadTour(VERIFICADOR_JSON_TOUR_ID, '/verificadorDTE/verificadorjson', 'Verificador JSON', {
    intro: {
      title: 'Verifica archivos JSON',
      description:
        'Sube tus JSON con código de generación y fecha de emisión. Nosotros consultamos el estado en Hacienda por ti.',
    },
    upload: {
      title: 'Paso 1: Sube tus JSON',
      description:
        'Arrastra uno o varios archivos .json. Cada uno debe traer codigoGeneracion y fecEmi dentro de identificacion.',
    },
    submit: {
      title: 'Paso 2: ¡A procesar!',
      description:
        'Pulsa Procesar para consultar Hacienda. Cuando termine, te enseñamos a descargar y filtrar los resultados.',
      doneBtnText: '¡Vamos!',
    },
  }),
  {
    id: VERIFICADOR_INDIVIDUAL_TOUR_ID,
    pathname: '/verificadorDTE/verificacion_individual',
    label: 'Verificación individual',
    steps: buildCustomVerifierTour([
      {
        popover: {
          title: 'Consulta DTEs uno por uno',
          description:
            'Ideal cuando tienes pocos documentos. Agrega código y fecha de cada DTE y valídalos sin necesidad de un archivo.',
          side: 'over',
          align: 'center',
        },
      },
      {
        element: UPLOAD_VERIFIER_SELECTORS.input,
        popover: {
          title: 'Paso 1: Agrega tus DTEs',
          description:
            'Escribe el código y la fecha de cada documento. Puedes agregar filas con +, pegar desde Excel con el botón de portapapeles, o elegir el ambiente (producción o pruebas).',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: UPLOAD_VERIFIER_SELECTORS.submit,
        popover: {
          title: 'Paso 2: ¡A validar!',
          description:
            'Cuando tengas tus códigos listos, pulsa Validar. Al terminar te mostramos cómo exportar y revisar la tabla de resultados.',
          side: 'top',
          align: 'start',
          doneBtnText: '¡Vamos!',
        },
      },
    ]),
    deferredSteps: uploadVerifierResultsSteps,
  },
  {
    id: VERIFICADOR_QR_TOUR_ID,
    pathname: '/verificadorDTE/verificador-qr',
    label: 'Escaneo QR DTE',
    steps: buildCustomVerifierTour([
      {
        popover: {
          title: 'Escanea QR de tus DTEs',
          description:
            'Usa la cámara de tu equipo para leer códigos QR de documentos tributarios y verificarlos con Hacienda.',
          side: 'over',
          align: 'center',
        },
      },
      {
        element: UPLOAD_VERIFIER_SELECTORS.qrCamera,
        popover: {
          title: 'Paso 1: Activa la cámara',
          description:
            'Pulsa "Permitir cámara y escanear" y apunta al código QR del DTE. Cada escaneo se agrega automáticamente a tu lista.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: UPLOAD_VERIFIER_SELECTORS.qrPending,
        popover: {
          title: 'Paso 2: Revisa lo escaneado',
          description:
            'Aquí ves los DTEs que acabas de leer. Puedes quitar alguno si te equivocaste antes de verificar.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: UPLOAD_VERIFIER_SELECTORS.submit,
        popover: {
          title: 'Paso 3: ¡A verificar!',
          description:
            'Pulsa "Verificar escaneos" cuando tu lista esté lista. Al terminar te mostramos cómo exportar los resultados.',
          side: 'top',
          align: 'start',
          doneBtnText: '¡Vamos!',
        },
      },
    ]),
    deferredSteps: uploadVerifierResultsSteps,
  },
];
