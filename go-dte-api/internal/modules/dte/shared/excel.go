package shared

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

var reportHeaders = []string{
	"url", "linkVisita", "visitar", "host", "ambiente", "codGen", "fechaEmi",
	"estado", "estadoRaw", "descripcionEstado", "tipoDte", "tipoDteNorm",
	"fechaHoraGeneracion", "fechaHoraTransmision", "fechaHoraProcesamiento",
	"codigoGeneracion", "selloRecepcion", "numeroControl", "montoTotal",
	"ivaOperaciones", "ivaPercibido", "ivaRetenido", "retencionRenta",
	"totalNoAfectos", "totalPagarOperacion", "otrosTributos",
	"documentoAjustado", "documentoEventoAplicado", "observacionesTexto",
	"ajustado", "error",
}

func BuildExcelBase64(results []Result) (string, error) {
	file := excelize.NewFile()
	defer file.Close()

	defaultSheet := file.GetSheetName(file.GetActiveSheetIndex())
	file.SetSheetName(defaultSheet, "Resumen")
	writeSummary(file, "Resumen", results)

	writeResultsSheet(file, "Todos", results)
	writeResultsSheet(file, "FACTURA", filterByType(results, "FACTURA"))
	writeResultsSheet(file, "COMPROBANTE DE CREDITO FISCAL", filterByType(results, "COMPROBANTE DE CREDITO FISCAL"))
	writeResultsSheet(file, "NOTA DE CREDITO", filterByType(results, "NOTA DE CREDITO"))
	writeResultsSheet(file, "Rechazados", filterRejected(results))
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

func writeResultsSheet(file *excelize.File, sheet string, results []Result) {
	name := sheetNameSafe(sheet)
	file.NewSheet(name)

	for col, header := range reportHeaders {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		file.SetCellValue(name, cell, header)
	}

	for row, r := range results {
		values := resultRow(r)
		for col, value := range values {
			cell, _ := excelize.CoordinatesToCellName(col+1, row+2)
			file.SetCellValue(name, cell, value)
		}
		if r.LinkVisita != "" {
			visitarCell, _ := excelize.CoordinatesToCellName(3, row+2)
			file.SetCellHyperLink(name, visitarCell, r.LinkVisita, "External")
		}
	}

	file.SetColWidth(name, "A", "AE", 22)
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
	headers := []string{"codGenPadre", "tipoDtePadre", "fechaGeneracion", "codigoGeneracion", "selloRecepcion", "tipoDocumentacion", "linkVisita", "visitar"}
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
	file.SetColWidth(sheet, "A", "H", 24)
}

func resultRow(r Result) []any {
	return []any{
		r.URL, r.LinkVisita, valueOr(r.Visitar, "Abrir"), r.Host, r.Ambiente, r.CodGen, r.FechaEmi,
		r.Estado, r.EstadoRaw, r.DescripcionEstado, r.TipoDte, r.TipoDteNorm,
		r.FechaHoraGeneracion, r.FechaHoraTransmision, r.FechaHoraProcesamiento,
		r.CodigoGeneracion, r.SelloRecepcion, r.NumeroControl, r.MontoTotal,
		r.IvaOperaciones, r.IvaPercibido, r.IvaRetenido, r.RetencionRenta,
		r.TotalNoAfectos, r.TotalPagarOperacion, r.OtrosTributos,
		r.DocumentoAjustado, r.DocumentoEventoAplicado, r.ObservacionesTexto,
		r.Ajustado, r.Error,
	}
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
