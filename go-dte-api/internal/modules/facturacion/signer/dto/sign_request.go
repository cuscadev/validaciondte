package dto

import "encoding/json"

type SignRequest struct {
	NIT         string          `json:"nit"`
	Activo      bool            `json:"activo"`
	PasswordPri string          `json:"passwordPri"`
	DTEJSON     json.RawMessage `json:"dteJson"`
}
