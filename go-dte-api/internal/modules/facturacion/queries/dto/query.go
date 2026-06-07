package dto

import "encoding/json"

type HaciendaQueryRequest struct {
	Environment      string          `json:"environment"`
	Ambiente         string          `json:"ambiente"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	CodGen           string          `json:"codGen"`
	NITEmisor        string          `json:"nitEmisor"`
	TipoDTE          string          `json:"tipoDte"`
	TDTE             string          `json:"tdte"`
	SelloRecepcion   string          `json:"selloRecepcion"`
	SelloRecibido    string          `json:"selloRecibido"`
	Payload          json.RawMessage `json:"payload"`
}

type HaciendaBatchQueryRequest struct {
	Environment string                 `json:"environment"`
	Items       []HaciendaQueryRequest `json:"items"`
}

type HaciendaLoteQueryRequest struct {
	Environment string `json:"environment"`
	CodigoLote  string `json:"codigoLote"`
}

type HaciendaQueryResult struct {
	Index            int    `json:"index,omitempty"`
	CodigoGeneracion string `json:"codigoGeneracion,omitempty"`
	CodigoLote       string `json:"codigoLote,omitempty"`
	Status           string `json:"status"`
	HTTPStatus       int    `json:"httpStatus,omitempty"`
	Error            string `json:"error,omitempty"`
	HaciendaResponse any    `json:"haciendaResponse,omitempty"`
}

type HaciendaBatchQueryResponse struct {
	Total      int                   `json:"total"`
	Resultados []HaciendaQueryResult `json:"resultados"`
}
