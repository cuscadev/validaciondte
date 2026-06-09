package domain

type NotaAjuste struct {
	Identificacion       IdentificacionNota     `json:"identificacion"`
	DocumentoRelacionado []DocumentoRelacionado `json:"documentoRelacionado"`
	Emisor               Emisor                 `json:"emisor"`
	Receptor             ReceptorNota           `json:"receptor"`
	VentaTercero         any                    `json:"ventaTercero"`
	CuerpoDocumento      []CuerpoDocumentoNota  `json:"cuerpoDocumento"`
	Resumen              ResumenNota            `json:"resumen"`
	Apendice             any                    `json:"apendice"`
}

type IdentificacionNota struct {
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
	Fusion           *string `json:"fusion"`
}

type DocumentoRelacionado struct {
	TipoDocumento   string `json:"tipoDocumento"`
	TipoGeneracion  int    `json:"tipoGeneracion"`
	NumeroDocumento string `json:"numeroDocumento"`
	FechaEmision    string `json:"fechaEmision"`
}

type ReceptorNota struct {
	TipoDocumento   string    `json:"tipoDocumento"`
	NumDocumento    string    `json:"numDocumento"`
	NRC             *string   `json:"nrc"`
	Nombre          string    `json:"nombre"`
	CodActividad    string    `json:"codActividad"`
	DescActividad   string    `json:"descActividad"`
	NombreComercial *string   `json:"nombreComercial"`
	Direccion       Direccion `json:"direccion"`
	Telefono        *string   `json:"telefono"`
	Correo          *string   `json:"correo"`
}

type CuerpoDocumentoNota struct {
	NumItem         int      `json:"numItem"`
	TipoItem        int      `json:"tipoItem"`
	NumeroDocumento string   `json:"numeroDocumento"`
	Cantidad        float64  `json:"cantidad"`
	Codigo          *string  `json:"codigo"`
	CodTributo      *string  `json:"codTributo"`
	UniMedida       int      `json:"uniMedida"`
	Descripcion     string   `json:"descripcion"`
	PrecioUni       float64  `json:"precioUni"`
	MontoDescu      float64  `json:"montoDescu"`
	VentaNoSuj      float64  `json:"ventaNoSuj"`
	VentaExenta     float64  `json:"ventaExenta"`
	VentaGravada    float64  `json:"ventaGravada"`
	Tributos        []string `json:"tributos"`
	NoGravado       float64  `json:"noGravado"`
	IVAPerci        float64  `json:"ivaPerci"`
	TotalIVA        float64  `json:"totalIva"`
	IVARete         float64  `json:"ivaRete"`
}

type ResumenNota struct {
	TotalNoSuj          float64 `json:"totalNoSuj"`
	TotalExenta         float64 `json:"totalExenta"`
	TotalGravada        float64 `json:"totalGravada"`
	SubTotalVentas      float64 `json:"subTotalVentas"`
	TotalDescu          float64 `json:"totalDescu"`
	Tributos            any     `json:"tributos"`
	MontoTotalOperacion float64 `json:"montoTotalOperacion"`
	IVAPerci            float64 `json:"ivaPerci"`
	TotalIVA            float64 `json:"totalIva"`
	IVARete             float64 `json:"ivaRete"`
	TotalNoGravado      float64 `json:"totalNoGravado"`
	TotalPagar          float64 `json:"totalPagar"`
	TotalLetras         string  `json:"totalLetras"`
	CondicionOperacion  int     `json:"condicionOperacion"`
	NumPagoElectronico  *string `json:"numPagoElectronico"`
	Observaciones       *string `json:"observaciones"`
	CodigoRetencionMH   *string `json:"codigoRetencionMH"`
}
