package domain

type ComprobanteCreditoFiscal struct {
	Identificacion       Identificacion                 `json:"identificacion"`
	DocumentoRelacionado any                            `json:"documentoRelacionado"`
	Emisor               Emisor                         `json:"emisor"`
	Receptor             ReceptorCreditoFiscal          `json:"receptor"`
	OtrosDocumentos      any                            `json:"otrosDocumentos"`
	VentaTercero         any                            `json:"ventaTercero"`
	CuerpoDocumento      []CuerpoDocumentoCreditoFiscal `json:"cuerpoDocumento"`
	Resumen              ResumenCreditoFiscal           `json:"resumen"`
	Apendice             any                            `json:"apendice"`
}

type ReceptorCreditoFiscal struct {
	NIT             string    `json:"nit"`
	NRC             *string   `json:"nrc"`
	Nombre          string    `json:"nombre"`
	CodActividad    string    `json:"codActividad"`
	DescActividad   string    `json:"descActividad"`
	NombreComercial *string   `json:"nombreComercial"`
	Direccion       Direccion `json:"direccion"`
	Telefono        *string   `json:"telefono"`
	Correo          *string   `json:"correo"`
}

type CuerpoDocumentoCreditoFiscal struct {
	NumItem         int      `json:"numItem"`
	TipoItem        int      `json:"tipoItem"`
	NumeroDocumento *string  `json:"numeroDocumento"`
	Codigo          *string  `json:"codigo"`
	CodTributo      *string  `json:"codTributo"`
	Descripcion     string   `json:"descripcion"`
	Cantidad        float64  `json:"cantidad"`
	UniMedida       int      `json:"uniMedida"`
	PrecioUni       float64  `json:"precioUni"`
	MontoDescu      float64  `json:"montoDescu"`
	VentaNoSuj      float64  `json:"ventaNoSuj"`
	VentaExenta     float64  `json:"ventaExenta"`
	VentaGravada    float64  `json:"ventaGravada"`
	Tributos        []string `json:"tributos"`
	PSV             float64  `json:"psv"`
	NoGravado       float64  `json:"noGravado"`
}

type ResumenCreditoFiscal struct {
	TotalNoSuj          float64 `json:"totalNoSuj"`
	TotalExenta         float64 `json:"totalExenta"`
	TotalGravada        float64 `json:"totalGravada"`
	SubTotalVentas      float64 `json:"subTotalVentas"`
	DescuNoSuj          float64 `json:"descuNoSuj"`
	DescuExenta         float64 `json:"descuExenta"`
	DescuGravada        float64 `json:"descuGravada"`
	PorcentajeDescuento float64 `json:"porcentajeDescuento"`
	TotalDescu          float64 `json:"totalDescu"`
	Tributos            any     `json:"tributos"`
	SubTotal            float64 `json:"subTotal"`
	IVAPerci            float64 `json:"ivaPerci"`
	IVARete             float64 `json:"ivaRete"`
	MontoTotalOperacion float64 `json:"montoTotalOperacion"`
	TotalNoGravado      float64 `json:"totalNoGravado"`
	TotalPagar          float64 `json:"totalPagar"`
	TotalLetras         string  `json:"totalLetras"`
	SaldoFavor          float64 `json:"saldoFavor"`
	CondicionOperacion  int     `json:"condicionOperacion"`
	Pagos               []Pago  `json:"pagos"`
	NumPagoElectronico  *string `json:"numPagoElectronico"`
	Observaciones       *string `json:"observaciones"`
}

type TributoResumen struct {
	Codigo      string  `json:"codigo"`
	Descripcion string  `json:"descripcion"`
	Valor       float64 `json:"valor"`
}
