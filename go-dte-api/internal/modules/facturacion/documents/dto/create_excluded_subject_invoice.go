package dto

import "encoding/json"

type CreateExcludedSubjectInvoiceRequest struct {
	Ambiente            string                       `json:"ambiente"`
	CodigoGeneracion    string                       `json:"codigoGeneracion"`
	NumeroControl       string                       `json:"numeroControl"`
	Correlativo         int64                        `json:"correlativo"`
	EstablecimientoTipo string                       `json:"establecimientoTipo"`
	Establecimiento     string                       `json:"establecimiento"`
	PuntoVenta          string                       `json:"puntoVenta"`
	FecEmi              string                       `json:"fecEmi"`
	HorEmi              string                       `json:"horEmi"`
	TipoModelo          int                          `json:"tipoModelo"`
	TipoOperacion       int                          `json:"tipoOperacion"`
	Emisor              EmisorInput                  `json:"emisor"`
	Receptor            ExcludedSubjectReceptorInput `json:"receptor"`
	Items               []ExcludedSubjectItemInput   `json:"items"`
	Pagos               []PagoInput                  `json:"pagos"`
	ReteRenta           float64                      `json:"reteRenta"`
	Observaciones       *string                      `json:"observaciones"`
	Apendice            []Apendice                   `json:"apendice"`
}

type ExcludedSubjectReceptorInput struct {
	TipoDocumento *string   `json:"tipoDocumento"`
	NumDocumento  string    `json:"numDocumento"`
	Nombre        string    `json:"nombre"`
	CodActividad  *string   `json:"codActividad"`
	DescActividad *string   `json:"descActividad"`
	Direccion     Direccion `json:"direccion"`
	Telefono      *string   `json:"telefono"`
	Correo        *string   `json:"correo"`
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

type CreateExcludedSubjectInvoiceResponse struct {
	Success          bool            `json:"success"`
	TipoDTE          string          `json:"tipoDte"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	TotalPagar       float64         `json:"totalPagar"`
	DTEJSON          json.RawMessage `json:"dteJson"`
}
