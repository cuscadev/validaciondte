package dto

type EmisorRow struct {
	ID                         int     `json:"id"`
	NIT                        string  `json:"nit"`
	NRC                        string  `json:"nrc"`
	Nombre                     string  `json:"nombre"`
	NombreComercial            *string `json:"nombreComercial,omitempty"`
	RazonSocial                *string `json:"razonSocial,omitempty"`
	TipoEstablecimientoCodigo  *string `json:"tipoEstablecimientoCodigo,omitempty"`
	CodigoActividad            *string `json:"codigoActividad,omitempty"`
	DescripcionActividad       *string `json:"descripcionActividad,omitempty"`
	DepartamentoCodigo         *string `json:"departamentoCodigo,omitempty"`
	MunicipioCodigo            *string `json:"municipioCodigo,omitempty"`
	DistritoCodigo             *string `json:"distritoCodigo,omitempty"`
	ComplementoDireccion       *string `json:"complementoDireccion,omitempty"`
	Telefono                   *string `json:"telefono,omitempty"`
	Correo                     *string `json:"correo,omitempty"`
	AmbienteCodigo             *string `json:"ambienteCodigo,omitempty"`
	CertificadoPath            *string `json:"certificadoPath,omitempty"`
	CodEstable                 *string `json:"codEstable,omitempty"`
	CodPuntoVenta              *string `json:"codPuntoVenta,omitempty"`
}

type DteEmisorInput struct {
	NIT             string    `json:"nit"`
	NRC             string    `json:"nrc"`
	Nombre          string    `json:"nombre"`
	CodActividad    string    `json:"codActividad"`
	DescActividad   string    `json:"descActividad"`
	NombreComercial *string   `json:"nombreComercial,omitempty"`
	Direccion       Direccion `json:"direccion"`
	Telefono        string    `json:"telefono"`
	Correo          string    `json:"correo"`
	CodEstable      *string   `json:"codEstable,omitempty"`
	CodPuntoVenta   *string   `json:"codPuntoVenta,omitempty"`
}

type Direccion struct {
	Departamento string `json:"departamento"`
	Municipio    string `json:"municipio"`
	Distrito     string `json:"distrito"`
	Complemento  string `json:"complemento"`
}
