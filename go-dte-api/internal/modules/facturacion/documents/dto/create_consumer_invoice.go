package dto

import "encoding/json"

type CreateConsumerInvoiceRequest struct {
	Ambiente            string        `json:"ambiente"`
	CodigoGeneracion    string        `json:"codigoGeneracion"`
	NumeroControl       string        `json:"numeroControl"`
	Correlativo         int64         `json:"correlativo"`
	EstablecimientoTipo string        `json:"establecimientoTipo"`
	Establecimiento     string        `json:"establecimiento"`
	PuntoVenta          string        `json:"puntoVenta"`
	FecEmi              string        `json:"fecEmi"`
	HorEmi              string        `json:"horEmi"`
	TipoModelo          int           `json:"tipoModelo"`
	TipoOperacion       int           `json:"tipoOperacion"`
	Emisor              EmisorInput   `json:"emisor"`
	Receptor            ReceptorInput `json:"receptor"`
	Items               []ItemInput   `json:"items"`
	Pagos               []PagoInput   `json:"pagos"`
	Observaciones       *string       `json:"observaciones"`
	Apendice            []Apendice    `json:"apendice"`
}

type EmisorInput struct {
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

type ReceptorInput struct {
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

type PagoInput struct {
	Codigo     *string  `json:"codigo"`
	MontoPago  float64  `json:"montoPago"`
	Referencia *string  `json:"referencia"`
	Plazo      *string  `json:"plazo"`
	Periodo    *float64 `json:"periodo"`
}

type Apendice struct {
	Campo    string `json:"campo"`
	Etiqueta string `json:"etiqueta"`
	Valor    string `json:"valor"`
}

type CreateConsumerInvoiceResponse struct {
	Success          bool            `json:"success"`
	TipoDTE          string          `json:"tipoDte"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	TotalPagar       float64         `json:"totalPagar"`
	DTEJSON          json.RawMessage `json:"dteJson"`
}
