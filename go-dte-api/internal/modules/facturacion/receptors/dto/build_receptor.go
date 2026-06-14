package dto

type Direccion struct {
	Departamento string `json:"departamento"`
	Municipio    string `json:"municipio"`
	Distrito     string `json:"distrito"`
	Complemento  string `json:"complemento"`
}

type BuildReceptorRequest struct {
	TipoDTE         string     `json:"tipoDte"`
	TipoDocumento   *string    `json:"tipoDocumento"`
	NumDocumento    *string    `json:"numDocumento"`
	NIT             *string    `json:"nit"`
	NRC             *string    `json:"nrc"`
	Nombre          *string    `json:"nombre"`
	CodActividad    *string    `json:"codActividad"`
	DescActividad   *string    `json:"descActividad"`
	NombreComercial *string    `json:"nombreComercial"`
	Direccion       *Direccion `json:"direccion"`
	Telefono        *string    `json:"telefono"`
	Correo          *string    `json:"correo"`
}

type BuildReceptorResponse struct {
	Success      bool   `json:"success"`
	TipoDTE      string `json:"tipoDte"`
	ReceptorKind string `json:"receptorKind"`
	Receptor     any    `json:"receptor"`
}
