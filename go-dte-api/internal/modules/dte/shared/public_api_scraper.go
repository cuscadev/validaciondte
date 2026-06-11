package shared

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	publicAPIHostAdmin  = "https://admin.factura.gob.sv"
	publicAPIHostWebapp = "https://webapp.dtes.mh.gob.sv"
	publicAPITimeout    = 8 * time.Second
)

type PublicAPIScraper struct {
	client *http.Client
	host   string
	source string
}

func NewAdminPublicAPIScraper() *PublicAPIScraper {
	return newPublicAPIScraper(publicAPIHostAdmin, "admin")
}

func NewWebappPublicAPIScraper() *PublicAPIScraper {
	return newPublicAPIScraper(publicAPIHostWebapp, "webapp")
}

func NewPublicAPIScraper() *PublicAPIScraper {
	return NewAdminPublicAPIScraper()
}

func newPublicAPIScraper(host, source string) *PublicAPIScraper {
	return &PublicAPIScraper{
		client: SharedHTTPClient(publicAPITimeout),
		host:   host,
		source: source,
	}
}

func (p *PublicAPIScraper) SourceName() string {
	if p == nil || p.source == "" {
		return "admin"
	}
	return p.source
}

func (p *PublicAPIScraper) Close() {}

func (p *PublicAPIScraper) ConsultarDTE(parent context.Context, rawURL string) Result {
	sanitized := SanitizarURL(rawURL)
	parsed, err := url.Parse(sanitized)
	if err != nil {
		return baseErrorResult(rawURL, err)
	}

	query := parsed.Query()
	ambiente := firstQuery(query, "ambiente")
	if ambiente == "" {
		ambiente = "01"
	}
	codGen := strings.ToUpper(firstQuery(query, "codGen", "codigoGeneracion"))
	fechaEmi := NormalizarFecha(firstQuery(query, "fechaEmi", "fecha"))

	base := baseErrorResult(rawURL, nil)
	base.Ambiente = ambiente
	base.CodGen = codGen
	base.FechaEmi = fechaEmi

	if codGen == "" || fechaEmi == "" {
		base.Error = "URL invalida: faltan codGen o fechaEmi"
		return base
	}

	envPrefix := publicAPIEnvPrefix(ambiente)
	apiURL := fmt.Sprintf(
		"%s/%s/consultas/publica/simple/1?codigoGeneracion=%s&fechaEmi=%s&ambiente=%s",
		p.host,
		envPrefix,
		url.QueryEscape(codGen),
		url.QueryEscape(fechaEmi),
		url.QueryEscape(ambiente),
	)

	req, err := http.NewRequestWithContext(parent, http.MethodGet, apiURL, nil)
	if err != nil {
		base.Error = err.Error()
		return base
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 VerificadorDTE-Go/1.0")
	req.Header.Set("Accept-Language", "es-SV,es;q=0.9")

	resp, err := p.client.Do(req)
	if err != nil {
		base.Error = err.Error()
		return base
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		base.Error = err.Error()
		return base
	}
	if resp.StatusCode >= 400 {
		base.Error = fmt.Sprintf("Hacienda respondio HTTP %d", resp.StatusCode)
		return base
	}

	var payload publicAPIResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		base.Error = err.Error()
		return base
	}

	return mapPublicAPIResponse(payload, base)
}

func publicAPIEnvPrefix(ambiente string) string {
	if strings.TrimSpace(ambiente) == "01" {
		return "prod"
	}
	return "test"
}

type publicAPIResponse struct {
	EstadoDoc         string              `json:"estadoDoc"`
	EstadoDocInc      string              `json:"estadoDocInc"`
	ReporteInc        bool                `json:"reporteInc"`
	DescripcionEstado string              `json:"descripcionEstado"`
	FechaEmi          string              `json:"fechaEmi"`
	HoraEmi           string              `json:"horaEmi"`
	FechaProcesado    string              `json:"fechaProcesado"`
	CodGen            string              `json:"codGen"`
	SelloVal          string              `json:"selloVal"`
	Action            string              `json:"action"`
	TipoDte           string              `json:"tipoDte"`
	NombDte           string              `json:"nombDte"`
	Ajustes           []publicAPIAjuste   `json:"ajustes"`
	Observaciones     []string            `json:"observaciones"`
	OtroEvento        []any               `json:"otroEvento"`
	Documento         *publicAPIDocumento `json:"documento"`
}

type publicAPIAjuste struct {
	TipDteRef           string `json:"tipDteRef"`
	CodigoGeneracionRef string `json:"codigoGeneracionRef"`
	NumValidacionRef    string `json:"numValidacionRef"`
	FecHorEmi           string `json:"fecHorEmi"`
}

type publicAPIResumen struct {
	MontoTotalOperacion  *float64           `json:"montoTotalOperacion"`
	TotalSujetoRetencion *float64           `json:"totalSujetoRetencion"`
	TotalPagar           *float64           `json:"totalPagar"`
	TotalIVAretenido     *float64           `json:"totalIVAretenido"`
	TotalIvaRetenido     *float64           `json:"totalIvaRetenido"`
	SubTotalVentas       *float64           `json:"subTotalVentas"`
	SubTotal             *float64           `json:"subTotal"`
	TotalGravada         *float64           `json:"totalGravada"`
	TotalExenta          *float64           `json:"totalExenta"`
	TotalNoSuj           *float64           `json:"totalNoSuj"`
	TotalIva             *float64           `json:"totalIva"`
	IvaRete              *float64           `json:"ivaRete"`
	IvaRete1             *float64           `json:"ivaRete1"`
	IvaPerci             *float64           `json:"ivaPerci"`
	IvaPerci1            *float64           `json:"ivaPerci1"`
	ReteRenta            *float64           `json:"reteRenta"`
	TotalNoGravado       *float64           `json:"totalNoGravado"`
	Tributos             []publicAPITributo `json:"tributos"`
}

type publicAPIDocumento struct {
	Identificacion struct {
		NumeroControl string `json:"numeroControl"`
		FecEmi        string `json:"fecEmi"`
		HorEmi        string `json:"horEmi"`
	} `json:"identificacion"`
	Resumen  publicAPIResumen `json:"resumen"`
	Emisor   *publicAPIParty  `json:"emisor"`
	Receptor *publicAPIParty  `json:"receptor"`
}

type publicAPITributo struct {
	Codigo      string   `json:"codigo"`
	Descripcion string   `json:"descripcion"`
	Valor       *float64 `json:"valor"`
}

type publicAPIParty struct {
	Nit             string `json:"nit"`
	Nrc             string `json:"nrc"`
	Nombre          string `json:"nombre"`
	CodActividad    string `json:"codActividad"`
	DescActividad   string `json:"descActividad"`
	NombreComercial string `json:"nombreComercial"`
	Telefono        string `json:"telefono"`
	Correo          string `json:"correo"`
	Direccion       *struct {
		Departamento string `json:"departamento"`
		Municipio    string `json:"municipio"`
		Complemento  string `json:"complemento"`
	} `json:"direccion"`
}

func mapPublicAPIResponse(payload publicAPIResponse, base Result) Result {
	estadoRaw := Clean(payload.EstadoDoc)
	if estadoRaw == "" {
		estadoRaw = Clean(payload.DescripcionEstado)
	}

	estado := NormalizarEstado(estadoRaw)
	if strings.EqualFold(payload.Action, "ADVERTENCIA") || strings.EqualFold(payload.EstadoDoc, "Error") {
		if estado == "DESCONOCIDO" {
			estado = "NO ENCONTRADO"
		}
	}

	tipoDte := Clean(payload.NombDte)
	if tipoDte == "" && payload.TipoDte != "" {
		tipoDte = mapTipoDteCode(payload.TipoDte)
	}

	result := base
	result.OK = estado != "ERROR" && estado != "NO ENCONTRADO"
	result.Estado = estado
	result.EstadoRaw = estadoRaw
	result.DescripcionEstado = Clean(payload.DescripcionEstado)
	result.EstadoDocInc = strings.ToUpper(Clean(payload.EstadoDocInc))
	result.EstadoDocIncDescripcion = resolveEstadoDocIncDescripcion(result.EstadoDocInc)
	result.ReporteInc = payload.ReporteInc
	result.TipoDte = tipoDte
	result.TipoDteNorm = NormalizarTipoDte(tipoDte)
	result.CodigoGeneracion = strings.ToUpper(Clean(payload.CodGen))
	result.CodGen = result.CodigoGeneracion
	result.SelloRecepcion = Clean(payload.SelloVal)
	result.FechaEmi = NormalizarFecha(payload.FechaEmi)
	result.FechaHoraGeneracion = joinDateTime(payload.FechaEmi, payload.HoraEmi)
	result.FechaHoraProcesamiento = Clean(payload.FechaProcesado)
	result.FechaHoraTransmision = Clean(payload.FechaProcesado)

	if payload.Documento != nil {
		result.NumeroControl = Clean(payload.Documento.Identificacion.NumeroControl)
		if result.FechaHoraGeneracion == "" {
			result.FechaHoraGeneracion = joinDateTime(
				payload.Documento.Identificacion.FecEmi,
				payload.Documento.Identificacion.HorEmi,
			)
		}
		result.MontoTotalOperacion = formatAPIAmount(
			payload.Documento.Resumen.MontoTotalOperacion,
			payload.Documento.Resumen.TotalSujetoRetencion,
		)
		result.MontoTotal = formatAPIAmount(
			payload.Documento.Resumen.SubTotalVentas,
			payload.Documento.Resumen.SubTotal,
			payload.Documento.Resumen.TotalGravada,
			payload.Documento.Resumen.TotalExenta,
			payload.Documento.Resumen.MontoTotalOperacion,
			payload.Documento.Resumen.TotalSujetoRetencion,
		)
		if result.MontoTotal == "" {
			result.MontoTotal = formatAPIAmount(payload.Documento.Resumen.TotalPagar)
		}
		result.TotalPagarOperacion = formatAPIAmount(
			payload.Documento.Resumen.TotalPagar,
			payload.Documento.Resumen.TotalIVAretenido,
			payload.Documento.Resumen.TotalIvaRetenido,
		)
		applyPublicAPIResumenTaxFields(&result, payload.Documento.Resumen)
		mapPublicAPIParty(payload.Documento.Emisor, &result, true)
		mapPublicAPIParty(payload.Documento.Receptor, &result, false)
	}

	result.Observaciones = mapPublicAPIObservationsWithCatalog(result.EstadoDocInc, payload.Observaciones)
	if len(result.Observaciones) > 0 {
		result.ObservacionesTexto = formatInconsistenciasTexto(result.EstadoDocInc, result.Observaciones)
		result.InconsistenciasCodigos = summarizeInconsistenciaCodigos(result.Observaciones)
	}

	result.Relacionados = mapPublicAPIAjustes(payload.Ajustes)
	if len(result.Relacionados) > 0 {
		result.RelacionadosTexto = formatRelacionadosTexto(result.Relacionados)
	}

	if len(payload.Ajustes) > 0 {
		result.Ajustado = true
		result.DocumentoAjustado = payload.Ajustes[0].CodigoGeneracionRef
	} else {
		result.DocumentoAjustado = "El documento no ha sido ajustado"
	}

	if len(payload.OtroEvento) > 0 {
		result.DocumentoEventoAplicado = "SI"
	} else {
		result.DocumentoEventoAplicado = "NO"
	}

	if !result.OK && result.Error == "" {
		result.Error = Clean(payload.DescripcionEstado)
	}

	return result
}

func mapPublicAPIParty(party *publicAPIParty, result *Result, emisor bool) {
	if party == nil || result == nil {
		return
	}
	if emisor {
		result.EmisorNit = Clean(party.Nit)
		result.EmisorNrc = Clean(party.Nrc)
		result.EmisorNombre = Clean(party.Nombre)
		result.EmisorCodActividad = Clean(party.CodActividad)
		result.EmisorDescActividad = Clean(party.DescActividad)
		result.EmisorNombreComercial = Clean(party.NombreComercial)
		result.EmisorTelefono = Clean(party.Telefono)
		result.EmisorCorreo = Clean(party.Correo)
		return
	}
	result.ReceptorNit = Clean(party.Nit)
	result.ReceptorNrc = Clean(party.Nrc)
	result.ReceptorNombre = Clean(party.Nombre)
	result.ReceptorCodActividad = Clean(party.CodActividad)
	result.ReceptorDescActividad = Clean(party.DescActividad)
	result.ReceptorNombreComercial = Clean(party.NombreComercial)
	result.ReceptorTelefono = Clean(party.Telefono)
	result.ReceptorCorreo = Clean(party.Correo)
	if party.Direccion != nil {
		result.ReceptorDepartamento = Clean(party.Direccion.Departamento)
		result.ReceptorMunicipio = Clean(party.Direccion.Municipio)
		result.ReceptorComplemento = Clean(party.Direccion.Complemento)
	}
}

func mapPublicAPIObservations(items []string) []Observation {
	out := make([]Observation, 0, len(items))
	for i, item := range items {
		text := Clean(item)
		if text == "" {
			continue
		}
		out = append(out, Observation{
			Numero:      strconv.Itoa(i + 1),
			Observacion: text,
		})
	}
	return out
}

func mapPublicAPIAjustes(items []publicAPIAjuste) []RelatedDocument {
	out := make([]RelatedDocument, 0, len(items))
	for _, item := range items {
		codigo := strings.ToUpper(Clean(item.CodigoGeneracionRef))
		if codigo == "" {
			continue
		}
		out = append(out, RelatedDocument{
			TipoDocumentacion: mapTipoDteCode(item.TipDteRef),
			CodigoGeneracion:  codigo,
			SelloRecepcion:    Clean(item.NumValidacionRef),
			FechaGeneracion:   parsePublicAPIDateTime(item.FecHorEmi),
		})
	}
	return out
}

func mapTipoDteCode(code string) string {
	code = strings.TrimSpace(code)
	if name := NormalizarTipoDte(code); name != "SIN_TIPO" {
		return name
	}
	switch code {
	case "01":
		return "FACTURA"
	case "03":
		return "COMPROBANTE DE CREDITO FISCAL"
	case "05":
		return "NOTA DE CREDITO"
	case "06":
		return "NOTA DE DEBITO"
	case "07":
		return "COMPROBANTE DE RETENCION"
	case "09":
		return "COMPROBANTE DE LIQUIDACION"
	case "11":
		return "FACTURA DE EXPORTACION"
	case "14":
		return "FACTURA SUJETO EXCLUIDO"
	case "15":
		return "COMPROBANTE DE DONACION"
	default:
		return code
	}
}

func parsePublicAPIDateTime(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if parsed, err := time.Parse("Mon Jan 2 15:04:05 MST 2006", raw); err == nil {
		return parsed.Format("2006-01-02 15:04:05")
	}
	if parsed, err := time.Parse("2006-01-02 15:04:05", raw); err == nil {
		return parsed.Format("2006-01-02 15:04:05")
	}
	return raw
}

func joinDateTime(date, clock string) string {
	date = NormalizarFecha(date)
	clock = Clean(clock)
	if date == "" {
		return clock
	}
	if clock == "" {
		return date
	}
	return date + " " + clock
}

func formatAPIAmount(values ...*float64) string {
	for _, value := range values {
		if value == nil {
			continue
		}
		return strconv.FormatFloat(*value, 'f', -1, 64)
	}
	return ""
}

func applyPublicAPIResumenTaxFields(result *Result, summary publicAPIResumen) {
	if result == nil {
		return
	}

	// Solo valores tal como vienen en la API de Hacienda (sin calcular ni inferir).
	result.IvaOperaciones = coalesceAmount(
		result.IvaOperaciones,
		formatAPIAmount(summary.TotalIva),
		formatTributoAmount(summary.Tributos, "20"),
	)
	result.IvaPercibido = coalesceAmount(
		result.IvaPercibido,
		formatAPIAmount(summary.IvaPerci, summary.IvaPerci1),
	)
	result.IvaRetenido = coalesceAmount(
		result.IvaRetenido,
		formatAPIAmount(
			summary.IvaRete,
			summary.IvaRete1,
			summary.TotalIVAretenido,
			summary.TotalIvaRetenido,
		),
	)
	result.RetencionRenta = coalesceAmount(
		result.RetencionRenta,
		formatAPIAmount(summary.ReteRenta),
	)
	result.TotalNoAfectos = coalesceAmount(
		result.TotalNoAfectos,
		formatAPIAmount(summary.TotalNoGravado, summary.TotalNoSuj),
	)
	if strings.TrimSpace(result.OtrosTributos) == "" {
		result.OtrosTributos = formatOtrosTributosAPI(summary.Tributos)
	}
}

func coalesceAmount(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func formatTributoAmount(items []publicAPITributo, code string) string {
	for _, item := range items {
		if strings.TrimSpace(item.Codigo) != code {
			continue
		}
		if v := formatAPIAmount(item.Valor); v != "" {
			return v
		}
	}
	return ""
}

func formatOtrosTributosAPI(items []publicAPITributo) string {
	if len(items) == 0 {
		return ""
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		codigo := strings.TrimSpace(item.Codigo)
		valor := formatAPIAmount(item.Valor)
		if codigo == "" || valor == "" || codigo == "20" {
			continue
		}
		parts = append(parts, codigo+": "+valor)
	}
	return strings.Join(parts, "; ")
}
