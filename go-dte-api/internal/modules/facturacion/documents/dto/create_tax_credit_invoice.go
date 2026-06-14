package dto

import "encoding/json"

type CreateTaxCreditInvoiceRequest struct {
	Ambiente            string                 `json:"ambiente"`
	CodigoGeneracion    string                 `json:"codigoGeneracion"`
	NumeroControl       string                 `json:"numeroControl"`
	Correlativo         int64                  `json:"correlativo"`
	EstablecimientoTipo string                 `json:"establecimientoTipo"`
	Establecimiento     string                 `json:"establecimiento"`
	PuntoVenta          string                 `json:"puntoVenta"`
	FecEmi              string                 `json:"fecEmi"`
	HorEmi              string                 `json:"horEmi"`
	TipoModelo          int                    `json:"tipoModelo"`
	TipoOperacion       int                    `json:"tipoOperacion"`
	Emisor              EmisorInput            `json:"emisor"`
	Receptor            TaxCreditReceptorInput `json:"receptor"`
	Items               []ItemInput            `json:"items"`
	Pagos               []PagoInput            `json:"pagos"`
	IVAPerci            float64                `json:"ivaPerci"`
	IVARete             float64                `json:"ivaRete"`
	Observaciones       *string                `json:"observaciones"`
	Apendice            []Apendice             `json:"apendice"`
}

type TaxCreditReceptorInput struct {
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

type CreateTaxCreditInvoiceResponse struct {
	Success          bool            `json:"success"`
	TipoDTE          string          `json:"tipoDte"`
	CodigoGeneracion string          `json:"codigoGeneracion"`
	NumeroControl    string          `json:"numeroControl"`
	TotalPagar       float64         `json:"totalPagar"`
	DTEJSON          json.RawMessage `json:"dteJson"`
}
