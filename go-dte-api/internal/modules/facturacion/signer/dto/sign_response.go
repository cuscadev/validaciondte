package dto

type SignResponse struct {
	Success bool   `json:"success"`
	Firma   string `json:"firma"`
}

type SignBatchResponse struct {
	Success    bool                        `json:"success"`
	Documentos []SignBatchDocumentResponse `json:"documentos"`
}

type SignBatchDocumentResponse struct {
	ID               string `json:"id,omitempty"`
	Success          bool   `json:"success"`
	CodigoGeneracion string `json:"codigoGeneracion,omitempty"`
	Firma            string `json:"firma,omitempty"`
	Error            string `json:"error,omitempty"`
}

type CompatResponse struct {
	Status string `json:"status"`
	Body   string `json:"body,omitempty"`
	Code   string `json:"code,omitempty"`
	Error  string `json:"error,omitempty"`
}
