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

const publicAPIHost = "https://admin.factura.gob.sv"

type PublicAPIScraper struct {
	client *http.Client
}

func NewPublicAPIScraper() *PublicAPIScraper {
	return &PublicAPIScraper{
		client: &http.Client{Timeout: 15 * time.Second},
	}
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
		publicAPIHost,
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
	EstadoDoc          string   `json:"estadoDoc"`
	DescripcionEstado  string   `json:"descripcionEstado"`
	FechaEmi           string   `json:"fechaEmi"`
	HoraEmi            string   `json:"horaEmi"`
	FechaProcesado     string   `json:"fechaProcesado"`
	CodGen             string   `json:"codGen"`
	SelloVal           string   `json:"selloVal"`
	Action             string   `json:"action"`
	TipoDte            string   `json:"tipoDte"`
	NombDte            string   `json:"nombDte"`
	Ajustes            []publicAPIAjuste `json:"ajustes"`
	Observaciones      []string `json:"observaciones"`
	Documento          *publicAPIDocumento `json:"documento"`
}

type publicAPIAjuste struct {
	TipDteRef            string `json:"tipDteRef"`
	CodigoGeneracionRef  string `json:"codigoGeneracionRef"`
	NumValidacionRef     string `json:"numValidacionRef"`
	FecHorEmi            string `json:"fecHorEmi"`
}

type publicAPIDocumento struct {
	Identificacion struct {
		NumeroControl string `json:"numeroControl"`
		FecEmi        string `json:"fecEmi"`
		HorEmi        string `json:"horEmi"`
	} `json:"identificacion"`
	Resumen struct {
		MontoTotalOperacion *float64 `json:"montoTotalOperacion"`
		TotalPagar          *float64 `json:"totalPagar"`
		TotalIva            *float64 `json:"totalIva"`
		IvaRete             *float64 `json:"ivaRete"`
		IvaPerci            *float64 `json:"ivaPerci"`
		ReteRenta           *float64 `json:"reteRenta"`
		TotalNoGravado      *float64 `json:"totalNoGravado"`
	} `json:"resumen"`
	Emisor   *publicAPIParty `json:"emisor"`
	Receptor *publicAPIParty `json:"receptor"`
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
	result.TipoDte = tipoDte
	result.TipoDteNorm = NormalizarTipoDte(tipoDte)
	result.CodigoGeneracion = strings.ToUpper(Clean(payload.CodGen))
	result.CodGen = result.CodigoGeneracion
	result.SelloRecepcion = Clean(payload.SelloVal)
	result.FechaEmi = NormalizarFecha(payload.FechaEmi)
	result.FechaHoraGeneracion = joinDateTime(payload.FechaEmi, payload.HoraEmi)
	result.FechaHoraProcesamiento = Clean(payload.FechaProcesado)

	if payload.Documento != nil {
		result.NumeroControl = Clean(payload.Documento.Identificacion.NumeroControl)
		if result.FechaHoraGeneracion == "" {
			result.FechaHoraGeneracion = joinDateTime(
				payload.Documento.Identificacion.FecEmi,
				payload.Documento.Identificacion.HorEmi,
			)
		}
		result.MontoTotal = formatAPIAmount(
			payload.Documento.Resumen.MontoTotalOperacion,
			payload.Documento.Resumen.TotalPagar,
		)
		result.TotalPagarOperacion = formatAPIAmount(payload.Documento.Resumen.TotalPagar)
		result.IvaOperaciones = formatAPIAmount(payload.Documento.Resumen.TotalIva)
		result.IvaRetenido = formatAPIAmount(payload.Documento.Resumen.IvaRete)
		result.IvaPercibido = formatAPIAmount(payload.Documento.Resumen.IvaPerci)
		result.RetencionRenta = formatAPIAmount(payload.Documento.Resumen.ReteRenta)
		result.TotalNoAfectos = formatAPIAmount(payload.Documento.Resumen.TotalNoGravado)
		mapPublicAPIParty(payload.Documento.Emisor, &result, true)
		mapPublicAPIParty(payload.Documento.Receptor, &result, false)
	}

	result.Observaciones = mapPublicAPIObservations(payload.Observaciones)
	if len(result.Observaciones) > 0 {
		lines := make([]string, 0, len(result.Observaciones))
		for _, obs := range result.Observaciones {
			lines = append(lines, obs.Numero+". "+obs.Observacion)
		}
		result.ObservacionesTexto = strings.Join(lines, "\n")
	}

	result.Relacionados = mapPublicAPIAjustes(payload.Ajustes)
	if len(result.Relacionados) > 0 {
		result.RelacionadosTexto = formatRelacionadosTexto(result.Relacionados)
	}

	if len(payload.Ajustes) > 0 {
		result.Ajustado = true
		result.DocumentoAjustado = payload.Ajustes[0].CodigoGeneracionRef
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
	case "09":
		return "COMPROBANTE DE LIQUIDACION"
	case "14":
		return "FACTURA SUJETO EXCLUIDO"
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
