package dto

import "encoding/json"

type SignRequest struct {
	NIT         string          `json:"nit"`
	Activo      bool            `json:"activo"`
	PasswordPri string          `json:"passwordPri"`
	DTEJSON     json.RawMessage `json:"dteJson"`
}

type SignBatchRequest struct {
	NIT         string              `json:"nit"`
	PasswordPri string              `json:"passwordPri"`
	Documentos  []SignBatchDocument `json:"documentos"`
}

type SignBatchDocument struct {
	ID      string          `json:"id"`
	DTEJSON json.RawMessage `json:"dteJson"`
}
