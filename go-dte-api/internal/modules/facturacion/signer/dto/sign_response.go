package dto

type SignResponse struct {
	Success bool   `json:"success"`
	Firma   string `json:"firma"`
}

type CompatResponse struct {
	Status string `json:"status"`
	Body   string `json:"body,omitempty"`
	Code   string `json:"code,omitempty"`
	Error  string `json:"error,omitempty"`
}
