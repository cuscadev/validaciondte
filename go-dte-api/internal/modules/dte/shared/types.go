package shared

type RelatedDocument struct {
	FechaGeneracion   string `json:"fechaGeneracion,omitempty"`
	CodigoGeneracion  string `json:"codigoGeneracion,omitempty"`
	SelloRecepcion    string `json:"selloRecepcion,omitempty"`
	TipoDocumentacion string `json:"tipoDocumentacion,omitempty"`
}

type Observation struct {
	Numero      string `json:"numero"`
	Observacion string `json:"observacion"`
}

type Result struct {
	OK                      bool              `json:"ok,omitempty"`
	URL                     string            `json:"url,omitempty"`
	LinkVisita              string            `json:"linkVisita,omitempty"`
	Visitar                 string            `json:"visitar,omitempty"`
	Host                    string            `json:"host,omitempty"`
	Ambiente                string            `json:"ambiente,omitempty"`
	CodGen                  string            `json:"codGen,omitempty"`
	FechaEmi                string            `json:"fechaEmi,omitempty"`
	Estado                  string            `json:"estado"`
	EstadoRaw               string            `json:"estadoRaw,omitempty"`
	TipoDte                 string            `json:"tipoDte,omitempty"`
	TipoDteNorm             string            `json:"tipoDteNorm,omitempty"`
	DescripcionEstado       string            `json:"descripcionEstado,omitempty"`
	FechaHoraGeneracion     string            `json:"fechaHoraGeneracion,omitempty"`
	FechaHoraTransmision    string            `json:"fechaHoraTransmision,omitempty"`
	FechaHoraProcesamiento  string            `json:"fechaHoraProcesamiento,omitempty"`
	CodigoGeneracion        string            `json:"codigoGeneracion,omitempty"`
	SelloRecepcion          string            `json:"selloRecepcion,omitempty"`
	NumeroControl           string            `json:"numeroControl,omitempty"`
	MontoTotal              string            `json:"montoTotal,omitempty"`
	IvaOperaciones          string            `json:"ivaOperaciones,omitempty"`
	IvaPercibido            string            `json:"ivaPercibido,omitempty"`
	IvaRetenido             string            `json:"ivaRetenido,omitempty"`
	RetencionRenta          string            `json:"retencionRenta,omitempty"`
	TotalNoAfectos          string            `json:"totalNoAfectos,omitempty"`
	TotalPagarOperacion     string            `json:"totalPagarOperacion,omitempty"`
	OtrosTributos           string            `json:"otrosTributos,omitempty"`
	DocumentoAjustado       string            `json:"documentoAjustado,omitempty"`
	DocumentoEventoAplicado string            `json:"documentoEventoAplicado,omitempty"`
	Ajustado                bool              `json:"ajustado,omitempty"`
	Relacionados            []RelatedDocument `json:"relacionados"`
	Observaciones           []Observation     `json:"observaciones,omitempty"`
	ObservacionesTexto      string            `json:"observacionesTexto,omitempty"`
	Error                   string            `json:"error,omitempty"`

	EmisorNit             string `json:"emisorNit,omitempty"`
	EmisorNrc             string `json:"emisorNrc,omitempty"`
	EmisorNombre          string `json:"emisorNombre,omitempty"`
	EmisorCodActividad    string `json:"emisorCodActividad,omitempty"`
	EmisorDescActividad   string `json:"emisorDescActividad,omitempty"`
	EmisorNombreComercial string `json:"emisorNombreComercial,omitempty"`
	EmisorTelefono        string `json:"emisorTelefono,omitempty"`
	EmisorCorreo          string `json:"emisorCorreo,omitempty"`

	ReceptorNit             string `json:"receptorNit,omitempty"`
	ReceptorNrc             string `json:"receptorNrc,omitempty"`
	ReceptorNombre          string `json:"receptorNombre,omitempty"`
	ReceptorCodActividad    string `json:"receptorCodActividad,omitempty"`
	ReceptorDescActividad   string `json:"receptorDescActividad,omitempty"`
	ReceptorDepartamento    string `json:"receptorDepartamento,omitempty"`
	ReceptorMunicipio       string `json:"receptorMunicipio,omitempty"`
	ReceptorComplemento     string `json:"receptorComplemento,omitempty"`
	ReceptorTelefono        string `json:"receptorTelefono,omitempty"`
	ReceptorCorreo          string `json:"receptorCorreo,omitempty"`
	ReceptorNombreComercial string `json:"receptorNombreComercial,omitempty"`
}

type ProcessResponse struct {
	Filename    string   `json:"filename,omitempty"`
	Total       int      `json:"total,omitempty"`
	Resultados  []Result `json:"resultados"`
	ExcelBase64 string   `json:"excelBase64,omitempty"`
}
