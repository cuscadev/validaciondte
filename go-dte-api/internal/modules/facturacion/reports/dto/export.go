package dto

type ExportRequest struct {
	Title string      `json:"title"`
	Rows  []ReportRow `json:"rows"`
}

type ReportRow struct {
	Fecha            string  `json:"fecha"`
	TipoDTE          string  `json:"tipoDte"`
	NumeroControl    string  `json:"numeroControl"`
	CodigoGeneracion string  `json:"codigoGeneracion"`
	Receptor         string  `json:"receptor"`
	SelloRecepcion   string  `json:"selloRecepcion"`
	Estado           string  `json:"estado"`
	Total            float64 `json:"total"`
}
