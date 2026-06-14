package dto

type BuildItemsRequest struct {
	TipoDTE              string                     `json:"tipoDte"`
	DocumentoRelacionado []RelatedDocumentInput     `json:"documentoRelacionado"`
	Items                []ItemInput                `json:"items"`
	SujetoExcluidoItems  []ExcludedSubjectItemInput `json:"sujetoExcluidoItems"`
	IVAPerci             float64                    `json:"ivaPerci"`
	IVARete              float64                    `json:"ivaRete"`
}

type RelatedDocumentInput struct {
	TipoDocumento   string `json:"tipoDocumento"`
	TipoGeneracion  int    `json:"tipoGeneracion"`
	NumeroDocumento string `json:"numeroDocumento"`
	FechaEmision    string `json:"fechaEmision"`
}

type ItemInput struct {
	TipoItem        int     `json:"tipoItem"`
	NumeroDocumento *string `json:"numeroDocumento"`
	Codigo          *string `json:"codigo"`
	CodTributo      *string `json:"codTributo"`
	Descripcion     string  `json:"descripcion"`
	Cantidad        float64 `json:"cantidad"`
	UniMedida       int     `json:"uniMedida"`
	PrecioUni       float64 `json:"precioUni"`
	MontoDescu      float64 `json:"montoDescu"`
	VentaNoSuj      float64 `json:"ventaNoSuj"`
	VentaExenta     float64 `json:"ventaExenta"`
	VentaGravada    float64 `json:"ventaGravada"`
	PSV             float64 `json:"psv"`
	NoGravado       float64 `json:"noGravado"`
}

type ExcludedSubjectItemInput struct {
	TipoItem    int     `json:"tipoItem"`
	Cantidad    float64 `json:"cantidad"`
	Codigo      *string `json:"codigo"`
	UniMedida   int     `json:"uniMedida"`
	Descripcion string  `json:"descripcion"`
	PrecioUni   float64 `json:"precioUni"`
	MontoDescu  float64 `json:"montoDescu"`
	Compra      float64 `json:"compra"`
}

type BuildItemsResponse struct {
	Success         bool    `json:"success"`
	TipoDTE         string  `json:"tipoDte"`
	ItemsKind       string  `json:"itemsKind"`
	CuerpoDocumento any     `json:"cuerpoDocumento"`
	Total           float64 `json:"total"`
}
