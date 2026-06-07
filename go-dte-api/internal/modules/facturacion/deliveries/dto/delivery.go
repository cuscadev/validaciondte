package dto

import "encoding/json"

type BuildDeliveryRequest struct {
	TipoDTE          string          `json:"tipoDte"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	DTEJSON          json.RawMessage `json:"dteJson"`
	Firma            string          `json:"firma"`
	SelloRecepcion   string          `json:"selloRecepcion"`
	HaciendaResponse json.RawMessage `json:"haciendaResponse"`
}

type BuildDeliveryResponse struct {
	Success          bool            `json:"success"`
	TipoDTE          string          `json:"tipoDte"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	SelloRecepcion   string          `json:"selloRecepcion"`
	FinalJSON        json.RawMessage `json:"finalJson"`
	Downloads        DownloadLinks   `json:"downloads"`
}

type DownloadLinks struct {
	JSON string `json:"json"`
	PDF  string `json:"pdf"`
}
