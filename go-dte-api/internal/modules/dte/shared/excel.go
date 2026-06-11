package shared

import (
	"bytes"

	"encoding/base64"

	"fmt"

	"strings"

	"github.com/xuri/excelize/v2"
)

var reportHeadersBeforeTributos = []string{

	"url", "nombreArchivo", "linkVisita", "visitar", "host", "ambiente", "codGen", "fechaEmi",

	"estado", "estadoRaw", "descripcionEstado", "estadoDocInc", "estadoDocIncDescripcion",
	"inconsistenciasCodigos", "tipoDte", "tipoDteNorm",

	"fechaHoraGeneracion", "fechaHoraTransmision", "fechaHoraProcesamiento",

	"codigoGeneracion", "selloRecepcion", "numeroControl",

	"emisorNit", "emisorNrc", "emisorNombre", "emisorCodActividad", "emisorDescActividad",
	"emisorNombreComercial", "emisorTelefono", "emisorCorreo",

	"receptorNit", "receptorNrc", "receptorNombre", "receptorCodActividad", "receptorDescActividad",
	"receptorNombreComercial", "receptorTelefono", "receptorCorreo",
	"receptorDepartamento", "receptorMunicipio", "receptorComplemento",

	"montoTotal", "montoTotalOperacion",

	"ivaOperaciones", "ivaPercibido", "ivaRetenido", "retencionRenta",

	"totalNoAfectos", "totalPagarOperacion",
}

var reportHeadersAfterTributos = []string{

	"documentoEventoAplicado", "observacionesTexto",

	"ajustado", "documentoAjustado",

	"tieneNotaCredito", "notaCreditoCodigoGeneracion", "notaCreditoFechaGeneracion", "notaCreditoFechaEmi",

	"notaCreditoSelloRecepcion", "notaCreditoTipoDocumento", "notaCreditoEstado", "notaCreditoEstadoRaw",

	"notaCreditoNumeroControl", "notaCreditoMontoTotal", "notaCreditoLinkVisita", "notaCreditoError",

	"relacionadosTexto", "error",
}

const reportHeaderOtrosTributos = "otrosTributos"

func buildReportHeaders(results []Result) []string {
	tributoCodes := CollectTributoCodes(results)
	headers := make([]string, 0, len(reportHeadersBeforeTributos)+1+len(tributoCodes)+len(reportHeadersAfterTributos))
	headers = append(headers, reportHeadersBeforeTributos...)
	headers = append(headers, reportHeaderOtrosTributos)
	for _, codigo := range tributoCodes {
		headers = append(headers, tributoColumnName(codigo))
	}
	headers = append(headers, reportHeadersAfterTributos...)
	return headers
}

func BuildExcelBase64(results []Result) (string, error) {

	file := excelize.NewFile()

	defer file.Close()

	defaultSheet := file.GetSheetName(file.GetActiveSheetIndex())

	file.SetSheetName(defaultSheet, "Resumen")

	writeSummary(file, "Resumen", results)

	headers := buildReportHeaders(results)
	tributoCodes := CollectTributoCodes(results)

	writeResultsSheet(file, "Todos", results, headers, tributoCodes)

	for _, tipo := range reportTypeSheets(results) {
		rows := filterByType(results, tipo)
		if len(rows) == 0 {
			continue
		}
		writeResultsSheet(file, tipo, rows, headers, tributoCodes)
	}

	writeResultsSheet(file, "Rechazados", filterRejected(results), headers, tributoCodes)

	writeRelatedSheet(file, results)

	var buf bytes.Buffer

	if err := file.Write(&buf); err != nil {

		return "", err

	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil

}

func writeSummary(file *excelize.File, sheet string, results []Result) {

	file.SetCellValue(sheet, "A1", "REPORTE DE VERIFICACION DE DTEs")

	file.SetCellValue(sheet, "A3", "Total de DTEs procesados")

	file.SetCellValue(sheet, "B3", len(results))

	file.SetCellValue(sheet, "A5", "RESUMEN POR ESTADO")

	file.SetCellValue(sheet, "A6", "Estado")

	file.SetCellValue(sheet, "B6", "Cantidad")

	counts := map[string]int{}

	for _, r := range results {

		counts[valueOr(r.Estado, "SIN_ESTADO")]++

	}

	row := 7

	for status, count := range counts {

		file.SetCellValue(sheet, fmt.Sprintf("A%d", row), status)

		file.SetCellValue(sheet, fmt.Sprintf("B%d", row), count)

		row++

	}

	file.SetColWidth(sheet, "A", "C", 28)

}

func writeResultsSheet(file *excelize.File, sheet string, results []Result, headers []string, tributoCodes []string) {

	name := sheetNameSafe(sheet)

	file.NewSheet(name)

	for col, header := range headers {

		cell, _ := excelize.CoordinatesToCellName(col+1, 1)

		file.SetCellValue(name, cell, header)

	}

	ncLinkCol := headerColumnIn(headers, "notaCreditoLinkVisita")

	for row, r := range results {

		values := resultRow(r, tributoCodes)

		for col, value := range values {

			cell, _ := excelize.CoordinatesToCellName(col+1, row+2)

			file.SetCellValue(name, cell, value)

		}

		if r.LinkVisita != "" {
			visitarCell, _ := excelize.CoordinatesToCellName(headerColumnIn(headers, "visitar"), row+2)

			file.SetCellHyperLink(name, visitarCell, r.LinkVisita, "External")

		}

		if r.NotaCreditoLinkVisita != "" && ncLinkCol > 0 {

			ncCell, _ := excelize.CoordinatesToCellName(ncLinkCol, row+2)

			file.SetCellHyperLink(name, ncCell, r.NotaCreditoLinkVisita, "External")

		}

	}

	if lastCol, err := excelize.ColumnNumberToName(len(headers)); err == nil {
		file.SetColWidth(name, "A", lastCol, 22)
	}

}

func writeRelatedSheet(file *excelize.File, results []Result) {

	rows := [][]any{}

	for _, result := range results {

		for _, rel := range result.Relacionados {

			rows = append(rows, []any{

				valueOr(result.CodGen, result.CodigoGeneracion),

				result.TipoDte,

				rel.FechaGeneracion,

				rel.CodigoGeneracion,

				rel.SelloRecepcion,

				rel.TipoDocumentacion,

				rel.Estado,

				rel.EstadoRaw,

				result.LinkVisita,

				"Abrir",
			})

		}

	}

	if len(rows) == 0 {

		return

	}

	sheet := "Relacionados"

	file.NewSheet(sheet)

	headers := []string{"codGenPadre", "tipoDtePadre", "fechaGeneracion", "codigoGeneracion", "selloRecepcion", "tipoDocumentacion", "estado", "estadoRaw", "linkVisita", "visitar"}

	for col, header := range headers {

		cell, _ := excelize.CoordinatesToCellName(col+1, 1)

		file.SetCellValue(sheet, cell, header)

	}

	for row, values := range rows {

		for col, value := range values {

			cell, _ := excelize.CoordinatesToCellName(col+1, row+2)

			file.SetCellValue(sheet, cell, value)

		}

	}

	file.SetColWidth(sheet, "A", "J", 24)

}

func resultRow(r Result, tributoCodes []string) []any {
	tributos := ResolveTributosPorCodigo(r)
	row := []any{

		r.URL, r.NombreArchivo, r.LinkVisita, valueOr(r.Visitar, "Abrir"), r.Host, r.Ambiente, r.CodGen, r.FechaEmi,

		r.Estado, r.EstadoRaw, r.DescripcionEstado, r.EstadoDocInc, r.EstadoDocIncDescripcion,
		r.InconsistenciasCodigos, r.TipoDte, r.TipoDteNorm,

		r.FechaHoraGeneracion, r.FechaHoraTransmision, r.FechaHoraProcesamiento,

		r.CodigoGeneracion, r.SelloRecepcion, r.NumeroControl,

		r.EmisorNit, r.EmisorNrc, r.EmisorNombre, r.EmisorCodActividad, r.EmisorDescActividad,
		r.EmisorNombreComercial, r.EmisorTelefono, r.EmisorCorreo,

		r.ReceptorNit, r.ReceptorNrc, r.ReceptorNombre, r.ReceptorCodActividad, r.ReceptorDescActividad,
		r.ReceptorNombreComercial, r.ReceptorTelefono, r.ReceptorCorreo,
		r.ReceptorDepartamento, r.ReceptorMunicipio, r.ReceptorComplemento,

		r.MontoTotal, r.MontoTotalOperacion,

		r.IvaOperaciones, r.IvaPercibido, r.IvaRetenido, r.RetencionRenta,

		r.TotalNoAfectos, r.TotalPagarOperacion,

		valueOr(r.OtrosTributos, formatOtrosTributosFromMap(tributos)),
	}
	for _, codigo := range tributoCodes {
		row = append(row, tributos[codigo])
	}
	row = append(row,
		r.DocumentoEventoAplicado, r.ObservacionesTexto,
		r.Ajustado, r.DocumentoAjustado,
		r.TieneNotaCredito, r.NotaCreditoCodigoGeneracion, r.NotaCreditoFechaGeneracion, r.NotaCreditoFechaEmi,
		r.NotaCreditoSelloRecepcion, r.NotaCreditoTipoDocumento, r.NotaCreditoEstado, r.NotaCreditoEstadoRaw,
		r.NotaCreditoNumeroControl, r.NotaCreditoMontoTotal, r.NotaCreditoLinkVisita, r.NotaCreditoError,
		r.RelacionadosTexto, r.Error,
	)
	return row
}

func headerColumnIn(headers []string, name string) int {

	for i, header := range headers {

		if header == name {

			return i + 1

		}

	}

	return 0

}

func filterByType(results []Result, typeNorm string) []Result {

	out := []Result{}

	for _, r := range results {

		if strings.EqualFold(r.TipoDteNorm, typeNorm) {

			out = append(out, r)

		}

	}

	return out

}

var defaultReportTypeSheets = []string{
	"FACTURA",
	"COMPROBANTE DE CREDITO FISCAL",
	"NOTA DE CREDITO",
	"COMPROBANTE DE RETENCION",
	"COMPROBANTE DE LIQUIDACION",
	"FACTURA SUJETO EXCLUIDO",
	"NOTA DE DEBITO",
	"FACTURA DE EXPORTACION",
	"COMPROBANTE DE DONACION",
}

func reportTypeSheets(results []Result) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(defaultReportTypeSheets)+4)
	appendType := func(tipo string) {
		tipo = strings.TrimSpace(tipo)
		if tipo == "" || tipo == "SIN_TIPO" || seen[tipo] {
			return
		}
		seen[tipo] = true
		out = append(out, tipo)
	}
	for _, tipo := range defaultReportTypeSheets {
		appendType(tipo)
	}
	for _, r := range results {
		appendType(r.TipoDteNorm)
	}
	return out
}

func filterRejected(results []Result) []Result {

	out := []Result{}

	for _, r := range results {

		if r.Estado == "RECHAZADO" || r.Estado == "INVALIDADO" {

			out = append(out, r)

		}

	}

	return out

}

func sheetNameSafe(name string) string {

	replacer := strings.NewReplacer(":", " ", "\\", " ", "/", " ", "?", " ", "*", " ", "[", " ", "]", " ")

	name = strings.TrimSpace(replacer.Replace(name))

	if len(name) > 31 {

		name = name[:31]

	}

	if name == "" {

		return "Hoja"

	}

	return name

}
