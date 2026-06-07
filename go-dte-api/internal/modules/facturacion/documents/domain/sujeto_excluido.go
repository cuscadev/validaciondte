package domain

type FacturaSujetoExcluido struct {
	Identificacion  Identificacion                  `json:"identificacion"`
	Emisor          EmisorSujetoExcluido            `json:"emisor"`
	Receptor        ReceptorSujetoExcluido          `json:"receptor"`
	CuerpoDocumento []CuerpoDocumentoSujetoExcluido `json:"cuerpoDocumento"`
	Resumen         ResumenSujetoExcluido           `json:"resumen"`
	Apendice        any                             `json:"apendice"`
}

type EmisorSujetoExcluido struct {
	NIT           string    `json:"nit"`
	NRC           string    `json:"nrc"`
	Nombre        string    `json:"nombre"`
	CodActividad  string    `json:"codActividad"`
	DescActividad string    `json:"descActividad"`
	Direccion     Direccion `json:"direccion"`
	Telefono      string    `json:"telefono"`
	CodEstable    *string   `json:"codEstable"`
	CodPuntoVenta *string   `json:"codPuntoVenta"`
	Correo        string    `json:"correo"`
}

type ReceptorSujetoExcluido struct {
	TipoDocumento *string   `json:"tipoDocumento"`
	NumDocumento  string    `json:"numDocumento"`
	Nombre        string    `json:"nombre"`
	CodActividad  *string   `json:"codActividad"`
	DescActividad *string   `json:"descActividad"`
	Direccion     Direccion `json:"direccion"`
	Telefono      *string   `json:"telefono"`
	Correo        *string   `json:"correo"`
}

type CuerpoDocumentoSujetoExcluido struct {
	NumItem     int     `json:"numItem"`
	TipoItem    int     `json:"tipoItem"`
	Cantidad    float64 `json:"cantidad"`
	Codigo      *string `json:"codigo"`
	UniMedida   int     `json:"uniMedida"`
	Descripcion string  `json:"descripcion"`
	PrecioUni   float64 `json:"precioUni"`
	MontoDescu  float64 `json:"montoDescu"`
	Compra      float64 `json:"compra"`
}

type ResumenSujetoExcluido struct {
	TotalCompra        float64 `json:"totalCompra"`
	Descu              float64 `json:"descu"`
	TotalDescu         float64 `json:"totalDescu"`
	SubTotal           float64 `json:"subTotal"`
	ReteRenta          float64 `json:"reteRenta"`
	TotalPagar         float64 `json:"totalPagar"`
	TotalLetras        string  `json:"totalLetras"`
	CondicionOperacion int     `json:"condicionOperacion"`
	Pagos              []Pago  `json:"pagos"`
	Observaciones      *string `json:"observaciones"`
}
