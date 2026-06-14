package dto

import "encoding/json"

type TransmitDTERequest struct {
	Environment string          `json:"environment"`
	Ambiente    string          `json:"ambiente"`
	IDEnvio     any             `json:"idEnvio"`
	Version     int             `json:"version"`
	TipoDTE     string          `json:"tipoDte"`
	Documento   string          `json:"documento"`
	Payload     json.RawMessage `json:"payload"`
}

type TransmitLoteRequest struct {
	Environment string          `json:"environment"`
	Ambiente    string          `json:"ambiente"`
	IDEnvio     any             `json:"idEnvio"`
	Version     int             `json:"version"`
	NitEmi      string          `json:"nitEmi"`
	NitEmisor   string          `json:"nitEmisor"`
	Documentos  []LoteDocumento `json:"documentos"`
	Payload     json.RawMessage `json:"payload"`
}

type LoteDocumento struct {
	TipoDTE          string `json:"tipoDte"`
	Version          int    `json:"version"`
	CodigoGeneracion string `json:"codigoGeneracion"`
	Documento        string `json:"documento"`
}
