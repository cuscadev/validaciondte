package dto

import "encoding/json"

type CreateAdjustmentNoteRequest struct {
	Ambiente             string                 `json:"ambiente"`
	CodigoGeneracion     string                 `json:"codigoGeneracion"`
	NumeroControl        string                 `json:"numeroControl"`
	Correlativo          int64                  `json:"correlativo"`
	EstablecimientoTipo  string                 `json:"establecimientoTipo"`
	Establecimiento      string                 `json:"establecimiento"`
	PuntoVenta           string                 `json:"puntoVenta"`
	FecEmi               string                 `json:"fecEmi"`
	HorEmi               string                 `json:"horEmi"`
	TipoModelo           int                    `json:"tipoModelo"`
	TipoOperacion        int                    `json:"tipoOperacion"`
	Fusion               *string                `json:"fusion"`
	Emisor               EmisorInput            `json:"emisor"`
	Receptor             NoteReceptorInput      `json:"receptor"`
	DocumentoRelacionado []RelatedDocumentInput `json:"documentoRelacionado"`
	Items                []ItemInput            `json:"items"`
	IVAPerci             float64                `json:"ivaPerci"`
	IVARete              float64                `json:"ivaRete"`
	Observaciones        *string                `json:"observaciones"`
	CodigoRetencionMH    *string                `json:"codigoRetencionMH"`
	Apendice             []Apendice             `json:"apendice"`
}

type RelatedDocumentInput struct {
	TipoDocumento   string `json:"tipoDocumento"`
	TipoGeneracion  int    `json:"tipoGeneracion"`
	NumeroDocumento string `json:"numeroDocumento"`
	FechaEmision    string `json:"fechaEmision"`
}

type NoteReceptorInput struct {
	TipoDocumento   string    `json:"tipoDocumento"`
	NumDocumento    string    `json:"numDocumento"`
	NRC             *string   `json:"nrc"`
	Nombre          string    `json:"nombre"`
	CodActividad    string    `json:"codActividad"`
	DescActividad   string    `json:"descActividad"`
	NombreComercial *string   `json:"nombreComercial"`
	Direccion       Direccion `json:"direccion"`
	Telefono        *string   `json:"telefono"`
	Correo          *string   `json:"correo"`
}

type CreateAdjustmentNoteResponse struct {
	Success          bool            `json:"success"`
	TipoDTE          string          `json:"tipoDte"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	TotalPagar       float64         `json:"totalPagar"`
	DTEJSON          json.RawMessage `json:"dteJson"`
}
