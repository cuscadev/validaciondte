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
