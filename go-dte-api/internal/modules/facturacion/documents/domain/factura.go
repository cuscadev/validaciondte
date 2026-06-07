package domain

type FacturaConsumidorFinal struct {
	Identificacion       Identificacion    `json:"identificacion"`
	DocumentoRelacionado any               `json:"documentoRelacionado"`
	Emisor               Emisor            `json:"emisor"`
	Receptor             *Receptor         `json:"receptor"`
	OtrosDocumentos      any               `json:"otrosDocumentos"`
	VentaTercero         any               `json:"ventaTercero"`
	CuerpoDocumento      []CuerpoDocumento `json:"cuerpoDocumento"`
	Resumen              Resumen           `json:"resumen"`
	Apendice             any               `json:"apendice"`
}

type Identificacion struct {
	Version          int     `json:"version"`
	Ambiente         string  `json:"ambiente"`
	TipoDTE          string  `json:"tipoDte"`
	NumeroControl    string  `json:"numeroControl"`
	CodigoGeneracion string  `json:"codigoGeneracion"`
	TipoModelo       int     `json:"tipoModelo"`
	TipoOperacion    int     `json:"tipoOperacion"`
	TipoContingencia *int    `json:"tipoContingencia"`
	MotivoContin     *string `json:"motivoContin"`
	FecEmi           string  `json:"fecEmi"`
	HorEmi           string  `json:"horEmi"`
	TipoMoneda       string  `json:"tipoMoneda"`
}

type Emisor struct {
	NIT             string    `json:"nit"`
	NRC             string    `json:"nrc"`
	Nombre          string    `json:"nombre"`
	CodActividad    string    `json:"codActividad"`
	DescActividad   string    `json:"descActividad"`
	NombreComercial *string   `json:"nombreComercial"`
	Direccion       Direccion `json:"direccion"`
	Telefono        string    `json:"telefono"`
	Correo          string    `json:"correo"`
	CodEstable      *string   `json:"codEstable"`
	CodPuntoVenta   *string   `json:"codPuntoVenta"`
}

type Receptor struct {
	TipoDocumento *string    `json:"tipoDocumento"`
	NumDocumento  *string    `json:"numDocumento"`
	NRC           *string    `json:"nrc"`
	Nombre        *string    `json:"nombre"`
	CodActividad  *string    `json:"codActividad"`
	DescActividad *string    `json:"descActividad"`
	Direccion     *Direccion `json:"direccion"`
	Telefono      *string    `json:"telefono"`
	Correo        *string    `json:"correo"`
}

type Direccion struct {
	Departamento string `json:"departamento"`
	Municipio    string `json:"municipio"`
	Distrito     string `json:"distrito"`
	Complemento  string `json:"complemento"`
}

type CuerpoDocumento struct {
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
	IVAItem         float64  `json:"ivaItem"`
}

type Resumen struct {
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
	IVARete             float64 `json:"ivaRete"`
	MontoTotalOperacion float64 `json:"montoTotalOperacion"`
	TotalNoGravado      float64 `json:"totalNoGravado"`
	TotalPagar          float64 `json:"totalPagar"`
	TotalLetras         string  `json:"totalLetras"`
	TotalIVA            float64 `json:"totalIva"`
	SaldoFavor          float64 `json:"saldoFavor"`
	CondicionOperacion  int     `json:"condicionOperacion"`
	Pagos               []Pago  `json:"pagos"`
	NumPagoElectronico  *string `json:"numPagoElectronico"`
	Observaciones       *string `json:"observaciones"`
}

type Pago struct {
	Codigo     *string  `json:"codigo"`
	MontoPago  float64  `json:"montoPago"`
	Referencia *string  `json:"referencia"`
	Plazo      *string  `json:"plazo"`
	Periodo    *float64 `json:"periodo"`
}
