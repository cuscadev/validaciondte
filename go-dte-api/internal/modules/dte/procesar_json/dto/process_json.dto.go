package dto

type ProcessItem struct {
	CodGen string `json:"codGen"`
	Fecha  string `json:"fecha"`
}

type ProcessJSONRequest struct {
	Items        []ProcessItem `json:"items"`
	PasteText    string        `json:"pasteText"`
	Ambiente     string        `json:"ambiente"`
	Concurrencia int           `json:"concurrencia"`
	IncludeExcel bool          `json:"includeExcel"`
}
