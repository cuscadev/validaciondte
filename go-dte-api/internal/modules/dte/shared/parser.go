package shared

import (
	"bytes"
	"net/url"
	"regexp"
	"strings"

	"github.com/xuri/excelize/v2"
)

var (
	uuidRegex = regexp.MustCompile(`^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$`)
	dmyRegex  = regexp.MustCompile(`^\d{2}[/-]\d{2}[/-]\d{4}$`)
	urlRegex  = regexp.MustCompile(`https?://(?:admin\.factura\.gob\.sv|webapp\.dtes\.mh\.gob\.sv)/consultaPublica/?\?[^\s,;"'<>]+`)
)

func Clean(s string) string {
	s = strings.ReplaceAll(s, "\u00a0", " ")
	return strings.Join(strings.Fields(s), " ")
}

func IsUUID(s string) bool {
	return uuidRegex.MatchString(strings.TrimSpace(s))
}

func IsDMY(s string) bool {
	return dmyRegex.MatchString(strings.TrimSpace(s))
}

func DMYToYMD(fecha string) string {
	fecha = strings.ReplaceAll(strings.TrimSpace(fecha), "-", "/")
	parts := strings.Split(fecha, "/")
	if len(parts) != 3 {
		return ""
	}
	return parts[2] + "-" + leftPad(parts[1], 2) + "-" + leftPad(parts[0], 2)
}

func NormalizarFecha(fecha string) string {
	f := strings.TrimSpace(fecha)
	if regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`).MatchString(f) {
		return f
	}
	if regexp.MustCompile(`^\d{2}/\d{2}/\d{4}$`).MatchString(f) {
		return DMYToYMD(f)
	}
	if regexp.MustCompile(`^\d{4}/\d{2}/\d{2}$`).MatchString(f) {
		return strings.ReplaceAll(f, "/", "-")
	}
	return f
}

func FechaEmiFromGeneracion(fecha string) string {
	fecha = Clean(fecha)
	if idx := strings.Index(fecha, " "); idx > 0 {
		fecha = fecha[:idx]
	}
	return NormalizarFecha(fecha)
}

func BuildConsultaURL(codGen, fechaYMD, ambiente string) string {
	q := url.Values{}
	q.Set("ambiente", ambiente)
	q.Set("codGen", strings.ToUpper(strings.TrimSpace(codGen)))
	if fechaYMD != "" {
		q.Set("fechaEmi", NormalizarFecha(fechaYMD))
	}
	return "https://admin.factura.gob.sv/consultaPublica?" + q.Encode()
}

func SanitizarURL(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.Trim(raw, "\"'`")
	raw = strings.ReplaceAll(raw, "&amp;", "&")
	raw = strings.ReplaceAll(raw, `\u0026`, "&")
	raw = strings.TrimRight(raw, ",.;")

	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}

	q := parsed.Query()
	codGen := firstQuery(q, "codGen", "CODGEN", "codigoGeneracion", "codigo_generacion", "codigo-generacion", "codigogeneracion", "codigoGen", "codigo")
	fecha := firstQuery(q, "fechaEmi", "fecha", "fechaEmision", "fecha_emision", "fecha-emision", "fechaGeneracion", "fecEmi")
	ambiente := firstQuery(q, "ambiente", "AMB", "amb", "env", "environment")
	if ambiente == "" {
		ambiente = "01"
	}
	if codGen == "" || fecha == "" {
		return raw
	}

	return BuildConsultaURL(codGen, NormalizarFecha(fecha), ambiente)
}

func ParseLinksFromFile(filename string, data []byte) []string {
	name := strings.ToLower(filename)
	if strings.HasSuffix(name, ".xlsx") || strings.HasSuffix(name, ".xlsm") || strings.HasSuffix(name, ".xls") {
		if links := parseLinksFromWorkbook(data); len(links) > 0 {
			return links
		}
	}
	return ParseLinksFromText(decodeText(data))
}

func ParseLinksFromText(text string) []string {
	text = strings.ReplaceAll(text, "\ufeff", "")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, `\u0026`, "&")

	out := parseSplitCSVLinks(text)
	for _, match := range urlRegex.FindAllString(text, -1) {
		out = append(out, SanitizarURL(match))
	}
	return out
}

type PastedItem struct {
	CodGen string
	Fecha  string
}

const MaxPastedItems = 10

func ParsePastedItems(text string) []PastedItem {
	lines := strings.Split(text, "\n")
	out := []PastedItem{}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || (strings.Contains(strings.ToLower(line), "cod") && strings.Contains(strings.ToLower(line), "fecha")) {
			continue
		}
		cells := splitCells(line)
		codGen := ""
		fecha := ""
		for _, cell := range cells {
			cell = strings.TrimSpace(cell)
			if codGen == "" && IsUUID(cell) {
				codGen = cell
			}
			if fecha == "" && IsDMY(cell) {
				fecha = strings.ReplaceAll(cell, "-", "/")
			}
		}
		if codGen != "" && fecha != "" {
			out = append(out, PastedItem{CodGen: strings.ToUpper(codGen), Fecha: fecha})
		}
		if len(out) >= MaxPastedItems {
			break
		}
	}

	return out
}

func NormalizarEstado(text string) string {
	t := strings.ToUpper(text)
	switch {
	case strings.Contains(t, "ANULAD"):
		return "ANULADO"
	case strings.Contains(t, "RECHAZAD"):
		return "RECHAZADO"
	case strings.Contains(t, "TRANSMITIDO") || strings.Contains(t, "REGISTRADO") || strings.Contains(t, "SATISFACTORIAMENTE"):
		return "EMITIDO"
	case strings.Contains(t, "INVALIDAD"):
		return "INVALIDADO"
	case strings.Contains(t, "NO ENCONTRADO") || strings.Contains(t, "NO EXISTE"):
		return "NO ENCONTRADO"
	default:
		return "DESCONOCIDO"
	}
}

func NormalizarTipoDte(text string) string {
	trimmed := strings.TrimSpace(text)
	switch trimmed {
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
	}

	t := removeAccents(strings.ToUpper(trimmed))
	switch {
	case strings.Contains(t, "FACTURA") && strings.Contains(t, "SUJETO") && strings.Contains(t, "EXCLUIDO"):
		return "FACTURA SUJETO EXCLUIDO"
	case strings.Contains(t, "LIQUIDACION"):
		return "COMPROBANTE DE LIQUIDACION"
	case strings.Contains(t, "FACTURA"):
		return "FACTURA"
	case strings.Contains(t, "COMPROBANTE") && strings.Contains(t, "CREDITO") && strings.Contains(t, "FISCAL"):
		return "COMPROBANTE DE CREDITO FISCAL"
	case strings.Contains(t, "NOTA") && strings.Contains(t, "CREDITO"):
		return "NOTA DE CREDITO"
	default:
		return "SIN_TIPO"
	}
}

func parseLinksFromWorkbook(data []byte) []string {
	file, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil
	}
	defer file.Close()

	out := []string{}
	for _, sheet := range file.GetSheetList() {
		rows, err := file.GetRows(sheet)
		if err != nil {
			continue
		}
		for _, row := range rows {
			for _, cell := range row {
				out = append(out, ParseLinksFromText(cell)...)
			}
		}
	}
	return out
}

func parseSplitCSVLinks(text string) []string {
	out := []string{}
	for _, line := range strings.Split(text, "\n") {
		if !strings.Contains(strings.ToLower(line), "consultapublica") {
			continue
		}
		params := map[string]string{}
		re := regexp.MustCompile(`(?i)(ambiente|codGen|fechaEmi)\s*=\s*([^&,\t;|"'<>\s]+)`)
		for _, match := range re.FindAllStringSubmatch(line, -1) {
			params[strings.ToLower(match[1])] = strings.TrimSpace(match[2])
		}
		if params["codgen"] != "" && params["fechaemi"] != "" {
			out = append(out, BuildConsultaURL(params["codgen"], params["fechaemi"], valueOr(params["ambiente"], "01")))
		}
	}
	return out
}

func decodeText(data []byte) string {
	if len(data) >= 2 && data[0] == 0xff && data[1] == 0xfe {
		runes := make([]rune, 0, len(data)/2)
		for i := 2; i+1 < len(data); i += 2 {
			runes = append(runes, rune(data[i])|rune(data[i+1])<<8)
		}
		return string(runes)
	}
	return string(data)
}

func splitCells(line string) []string {
	for _, sep := range []string{"\t", ";", ","} {
		if strings.Contains(line, sep) {
			return strings.Split(line, sep)
		}
	}
	return regexp.MustCompile(`\s{2,}`).Split(line, -1)
}

func firstQuery(values url.Values, names ...string) string {
	for _, name := range names {
		for key, vals := range values {
			if strings.EqualFold(strings.TrimSpace(key), name) && len(vals) > 0 {
				return strings.TrimSpace(vals[0])
			}
		}
	}
	return ""
}

func removeAccents(s string) string {
	replacer := strings.NewReplacer(
		"\u00c1", "A", "\u00c9", "E", "\u00cd", "I", "\u00d3", "O", "\u00da", "U", "\u00d1", "N",
		"\u00e1", "a", "\u00e9", "e", "\u00ed", "i", "\u00f3", "o", "\u00fa", "u", "\u00f1", "n",
		"Ã¡", "a", "Ã©", "e", "Ã­", "i", "Ã³", "o", "Ãº", "u", "Ã±", "n",
		"Ã", "A", "Ã‰", "E", "Ã", "I", "Ã“", "O", "Ãš", "U", "Ã‘", "N",
	)
	return replacer.Replace(s)
}

func leftPad(s string, width int) string {
	for len(s) < width {
		s = "0" + s
	}
	return s
}

func valueOr(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
