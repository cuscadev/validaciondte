package shared

type RelatedDocument struct {
	FechaGeneracion   string `json:"fechaGeneracion,omitempty"`
	CodigoGeneracion  string `json:"codigoGeneracion,omitempty"`
	SelloRecepcion    string `json:"selloRecepcion,omitempty"`
	TipoDocumentacion string `json:"tipoDocumentacion,omitempty"`
	Estado            string `json:"estado,omitempty"`
	EstadoRaw         string `json:"estadoRaw,omitempty"`
	Verificado        bool   `json:"verificado,omitempty"`
	Error             string `json:"error,omitempty"`
}

type Observation struct {
	Numero               string `json:"numero"`
	Observacion          string `json:"observacion"`
	CodigoInconsistencia string `json:"codigoInconsistencia,omitempty"`
	DescripcionCatalogo  string `json:"descripcionCatalogo,omitempty"`
}

type Result struct {
	OK                      bool              `json:"ok,omitempty"`
	NombreArchivo           string            `json:"nombreArchivo,omitempty"`
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
	EstadoDocInc            string            `json:"estadoDocInc,omitempty"`
	EstadoDocIncDescripcion string            `json:"estadoDocIncDescripcion,omitempty"`
	ReporteInc              bool              `json:"reporteInc,omitempty"`
	InconsistenciasCodigos  string            `json:"inconsistenciasCodigos,omitempty"`
	FechaHoraGeneracion     string            `json:"fechaHoraGeneracion,omitempty"`
	FechaHoraTransmision    string            `json:"fechaHoraTransmision,omitempty"`
	FechaHoraProcesamiento  string            `json:"fechaHoraProcesamiento,omitempty"`
	CodigoGeneracion        string            `json:"codigoGeneracion,omitempty"`
	SelloRecepcion          string            `json:"selloRecepcion,omitempty"`
	NumeroControl           string            `json:"numeroControl,omitempty"`
	MontoTotal              string            `json:"montoTotal,omitempty"`
	MontoTotalOperacion     string            `json:"montoTotalOperacion,omitempty"`
	IvaOperaciones          string            `json:"ivaOperaciones,omitempty"`
	IvaPercibido            string            `json:"ivaPercibido,omitempty"`
	IvaRetenido             string            `json:"ivaRetenido,omitempty"`
	RetencionRenta          string            `json:"retencionRenta,omitempty"`
	TotalNoAfectos          string            `json:"totalNoAfectos,omitempty"`
	TotalPagarOperacion     string            `json:"totalPagarOperacion,omitempty"`
	OtrosTributos           string            `json:"otrosTributos,omitempty"`
	TributosPorCodigo       map[string]string `json:"tributosPorCodigo,omitempty"`
	DocumentoAjustado       string            `json:"documentoAjustado,omitempty"`
	DocumentoEventoAplicado string            `json:"documentoEventoAplicado,omitempty"`
	Ajustado                bool              `json:"ajustado,omitempty"`
	Relacionados            []RelatedDocument `json:"relacionados"`
	Observaciones           []Observation     `json:"observaciones,omitempty"`
	ObservacionesTexto      string            `json:"observacionesTexto,omitempty"`
	RelacionadosTexto       string            `json:"relacionadosTexto,omitempty"`
	Error                   string            `json:"error,omitempty"`

	TieneNotaCredito            bool   `json:"tieneNotaCredito,omitempty"`
	NotaCreditoCodigoGeneracion string `json:"notaCreditoCodigoGeneracion,omitempty"`
	NotaCreditoSelloRecepcion   string `json:"notaCreditoSelloRecepcion,omitempty"`
	NotaCreditoFechaGeneracion  string `json:"notaCreditoFechaGeneracion,omitempty"`
	NotaCreditoFechaEmi         string `json:"notaCreditoFechaEmi,omitempty"`
	NotaCreditoTipoDocumento    string `json:"notaCreditoTipoDocumento,omitempty"`
	NotaCreditoNumeroControl    string `json:"notaCreditoNumeroControl,omitempty"`
	NotaCreditoMontoTotal       string `json:"notaCreditoMontoTotal,omitempty"`
	NotaCreditoEstado           string `json:"notaCreditoEstado,omitempty"`
	NotaCreditoEstadoRaw        string `json:"notaCreditoEstadoRaw,omitempty"`
	NotaCreditoLinkVisita       string `json:"notaCreditoLinkVisita,omitempty"`
	NotaCreditoError            string `json:"notaCreditoError,omitempty"`

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
	JobID       string   `json:"jobId,omitempty"`
	Status      string   `json:"status,omitempty"`
	Filename    string   `json:"filename,omitempty"`
	Total       int      `json:"total,omitempty"`
	Done        int      `json:"done,omitempty"`
	Resultados  []Result `json:"resultados"`
	ExcelBase64 string   `json:"excelBase64,omitempty"`
}
