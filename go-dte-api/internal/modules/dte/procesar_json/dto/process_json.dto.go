package dto

type ProcessItem struct {
	CodGen   string `json:"codGen"`
	Fecha    string `json:"fecha"`
	FechaYmd string `json:"fechaYmd"`
}

type ProcessJSONRequest struct {
	Items        []ProcessItem `json:"items"`
	PasteText    string        `json:"pasteText"`
	Ambiente     string        `json:"ambiente"`
	Concurrencia int           `json:"concurrencia"`
	IncludeExcel bool          `json:"includeExcel"`
}
