package domain

type FacturaExportacion struct {
	Identificacion  Identificacion               `json:"identificacion"`
	Emisor          Emisor                       `json:"emisor"`
	Receptor        ReceptorExportacion          `json:"receptor"`
	OtrosDocumentos any                          `json:"otrosDocumentos"`
	VentaTercero    any                          `json:"ventaTercero"`
	CuerpoDocumento []CuerpoDocumentoExportacion `json:"cuerpoDocumento"`
	Resumen         ResumenExportacion           `json:"resumen"`
	Apendice        any                          `json:"apendice"`
}

type ReceptorExportacion struct {
	TipoDocumento   *string `json:"tipoDocumento"`
	NumDocumento    *string `json:"numDocumento"`
	TipoPersona     int     `json:"tipoPersona"`
	Nombre          string  `json:"nombre"`
	NombreComercial *string `json:"nombreComercial"`
	CodPais         string  `json:"codPais"`
	NombrePais      string  `json:"nombrePais"`
	Complemento     string  `json:"complemento"`
	DescActividad   *string `json:"descActividad"`
	Telefono        *string `json:"telefono"`
	Correo          *string `json:"correo"`
}

type OtrosDocumentosExportacion struct {
	CodDocAsociado   int     `json:"codDocAsociado"`
	DescDocumento    *string `json:"descDocumento"`
	DetalleDocumento *string `json:"detalleDocumento"`
	ModoTransp       *int    `json:"modoTransp"`
	PlacaTrans       *string `json:"placaTrans"`
	NumConductor     *string `json:"numConductor"`
	NombreConductor  *string `json:"nombreConductor"`
}

type VentaTercero struct {
	NIT    string `json:"nit"`
	Nombre string `json:"nombre"`
}

type CuerpoDocumentoExportacion struct {
	NumItem      int      `json:"numItem"`
	Cantidad     float64  `json:"cantidad"`
	Codigo       *string  `json:"codigo"`
	UniMedida    int      `json:"uniMedida"`
	Descripcion  string   `json:"descripcion"`
	PrecioUni    float64  `json:"precioUni"`
	MontoDescu   float64  `json:"montoDescu"`
	VentaGravada float64  `json:"ventaGravada"`
	Tributos     []string `json:"tributos"`
	NoGravado    float64  `json:"noGravado"`
}

type ResumenExportacion struct {
	TotalGravada        float64 `json:"totalGravada"`
	PorcentajeDescuento float64 `json:"porcentajeDescuento"`
	TotalDescu          float64 `json:"totalDescu"`
	MontoTotalOperacion float64 `json:"montoTotalOperacion"`
	TotalNoGravado      float64 `json:"totalNoGravado"`
	TotalPagar          float64 `json:"totalPagar"`
	TotalLetras         string  `json:"totalLetras"`
	CondicionOperacion  int     `json:"condicionOperacion"`
	Pagos               []Pago  `json:"pagos"`
	NumPagoElectronico  *string `json:"numPagoElectronico"`
	CodIncoterms        *string `json:"codIncoterms"`
	DescIncoterms       *string `json:"descIncoterms"`
	Flete               float64 `json:"flete"`
	Seguro              float64 `json:"seguro"`
	Observaciones       *string `json:"observaciones"`
}
