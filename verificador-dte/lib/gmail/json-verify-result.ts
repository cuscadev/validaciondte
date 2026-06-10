export type GmailJsonVerifyResult = {
  nombreArchivo?: string;
  url?: string;
  linkVisita?: string;
  visitar?: string;
  codGen?: string;
  codigoGeneracion?: string;
  fechaEmi?: string;
  estado?: string;
  descripcionEstado?: string;
  tipoDte?: string;
  numeroControl?: string;
  emisorNit?: string;
  emisorNrc?: string;
  emisorNombre?: string;
  receptorNit?: string;
  receptorNrc?: string;
  receptorNombre?: string;
  montoTotal?: string;
  error?: string;
};

export type EmailJsonVerifyResult = GmailJsonVerifyResult;
