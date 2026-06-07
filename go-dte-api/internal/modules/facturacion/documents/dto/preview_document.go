package dto

import "encoding/json"

type PreviewDocumentRequest struct {
	TipoDTE                string                               `json:"tipoDte"`
	FacturaConsumidorFinal *CreateConsumerInvoiceRequest        `json:"facturaConsumidorFinal"`
	CreditoFiscal          *CreateTaxCreditInvoiceRequest       `json:"creditoFiscal"`
	Nota                   *CreateAdjustmentNoteRequest         `json:"nota"`
	SujetoExcluido         *CreateExcludedSubjectInvoiceRequest `json:"sujetoExcluido"`
}

type PreviewDocumentResponse struct {
	Success          bool            `json:"success"`
	TipoDTE          string          `json:"tipoDte"`
	Version          int             `json:"version"`
	Nombre           string          `json:"nombre"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	TotalPagar       float64         `json:"totalPagar"`
	ReceptorKind     string          `json:"receptorKind"`
	ItemsKind        string          `json:"itemsKind"`
	DTEJSON          json.RawMessage `json:"dteJson"`
}
