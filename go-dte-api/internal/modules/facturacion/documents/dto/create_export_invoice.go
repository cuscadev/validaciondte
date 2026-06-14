package dto

import "encoding/json"

type CreateExportInvoiceRequest struct {
	Ambiente            string                `json:"ambiente"`
	CodigoGeneracion    string                `json:"codigoGeneracion"`
	NumeroControl       string                `json:"numeroControl"`
	Correlativo         int64                 `json:"correlativo"`
	EstablecimientoTipo string                `json:"establecimientoTipo"`
	Establecimiento     string                `json:"establecimiento"`
	PuntoVenta          string                `json:"puntoVenta"`
	FecEmi              string                `json:"fecEmi"`
	HorEmi              string                `json:"horEmi"`
	TipoModelo          int                   `json:"tipoModelo"`
	TipoOperacion       int                   `json:"tipoOperacion"`
	Emisor              EmisorInput           `json:"emisor"`
	Receptor            ExportReceptorInput   `json:"receptor"`
	OtrosDocumentos     []ExportOtherDocument `json:"otrosDocumentos"`
	VentaTercero        *VentaTerceroInput    `json:"ventaTercero"`
	Items               []ItemInput           `json:"items"`
	CondicionOperacion  int                   `json:"condicionOperacion"`
	Pagos               []PagoInput           `json:"pagos"`
	CodIncoterms        *string               `json:"codIncoterms"`
	DescIncoterms       *string               `json:"descIncoterms"`
	Flete               float64               `json:"flete"`
	Seguro              float64               `json:"seguro"`
	Observaciones       *string               `json:"observaciones"`
	Apendice            []Apendice            `json:"apendice"`
}

type ExportReceptorInput struct {
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

type ExportOtherDocument struct {
	CodDocAsociado   int     `json:"codDocAsociado"`
	DescDocumento    *string `json:"descDocumento"`
	DetalleDocumento *string `json:"detalleDocumento"`
	ModoTransp       *int    `json:"modoTransp"`
	PlacaTrans       *string `json:"placaTrans"`
	NumConductor     *string `json:"numConductor"`
	NombreConductor  *string `json:"nombreConductor"`
}

type VentaTerceroInput struct {
	NIT    string `json:"nit"`
	Nombre string `json:"nombre"`
}

type CreateExportInvoiceResponse struct {
	Success          bool            `json:"success"`
	TipoDTE          string          `json:"tipoDte"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	TotalPagar       float64         `json:"totalPagar"`
	DTEJSON          json.RawMessage `json:"dteJson"`
}
