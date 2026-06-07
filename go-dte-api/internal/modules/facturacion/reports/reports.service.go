package reports

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/reports/dto"
)

type Service struct{}

type ExportResult struct {
	ContentType string
	FileName    string
	Body        []byte
}

func NewService() *Service {
	return &Service{}
}

func (s *Service) Export(format string, req dto.ExportRequest) (ExportResult, error) {
	format = strings.ToLower(strings.TrimSpace(format))
	if req.Title == "" {
		req.Title = "reporte-dte"
	}

	switch format {
	case "csv":
		body, err := buildCSV(req.Rows)
		return ExportResult{ContentType: "text/csv", FileName: safeFileName(req.Title) + ".csv", Body: body}, err
	case "xlsx", "excel":
		body, err := buildXLSX(req.Title, req.Rows)
		return ExportResult{ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", FileName: safeFileName(req.Title) + ".xlsx", Body: body}, err
	case "pdf":
		body := buildPDF(req.Title, req.Rows)
		return ExportResult{ContentType: "application/pdf", FileName: safeFileName(req.Title) + ".pdf", Body: body}, nil
	default:
		return ExportResult{}, fmt.Errorf("formato no soportado: %s", format)
	}
}

func buildCSV(rows []dto.ReportRow) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	if err := writer.Write(headers()); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if err := writer.Write(rowValues(row)); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	return buf.Bytes(), writer.Error()
}

func buildXLSX(title string, rows []dto.ReportRow) ([]byte, error) {
	file := excelize.NewFile()
	sheet := "Reporte"
	file.SetSheetName("Sheet1", sheet)

	for i, header := range headers() {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = file.SetCellValue(sheet, cell, header)
	}
	for r, row := range rows {
		for c, value := range rowValues(row) {
			cell, _ := excelize.CoordinatesToCellName(c+1, r+2)
			_ = file.SetCellValue(sheet, cell, value)
		}
	}

	_ = file.SetColWidth(sheet, "A", "H", 18)
	_ = file.SetDocProps(&excelize.DocProperties{Title: title})

	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func buildPDF(title string, rows []dto.ReportRow) []byte {
	lines := []string{title, ""}
	lines = append(lines, strings.Join(headers(), " | "))
	for _, row := range rows {
		lines = append(lines, strings.Join(rowValues(row), " | "))
	}
	if len(lines) > 42 {
		lines = lines[:42]
		lines = append(lines, "... reporte truncado para vista PDF")
	}

	stream := "BT\n/F1 9 Tf\n40 790 Td\n"
	for i, line := range lines {
		if i > 0 {
			stream += "0 -16 Td\n"
		}
		stream += "(" + escapePDF(line) + ") Tj\n"
	}
	stream += "ET"

	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		"<< /Length " + strconv.Itoa(len(stream)) + " >>\nstream\n" + stream + "\nendstream",
	}

	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")
	offsets := []int{0}
	for i, obj := range objects {
		offsets = append(offsets, buf.Len())
		buf.WriteString(strconv.Itoa(i+1) + " 0 obj\n" + obj + "\nendobj\n")
	}
	xref := buf.Len()
	buf.WriteString("xref\n0 " + strconv.Itoa(len(objects)+1) + "\n")
	buf.WriteString("0000000000 65535 f \n")
	for _, offset := range offsets[1:] {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", offset))
	}
	buf.WriteString("trailer\n<< /Size " + strconv.Itoa(len(objects)+1) + " /Root 1 0 R >>\n")
	buf.WriteString("startxref\n" + strconv.Itoa(xref) + "\n%%EOF")
	return buf.Bytes()
}

func headers() []string {
	return []string{"Fecha", "Tipo DTE", "Numero Control", "Codigo Generacion", "Receptor", "Sello Recepcion", "Estado", "Total"}
}

func rowValues(row dto.ReportRow) []string {
	return []string{
		row.Fecha,
		row.TipoDTE,
		row.NumeroControl,
		row.CodigoGeneracion,
		row.Receptor,
		row.SelloRecepcion,
		row.Estado,
		fmt.Sprintf("%.2f", row.Total),
	}
}

func safeFileName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "reporte-dte"
	}
	var out strings.Builder
	for _, char := range value {
		switch {
		case char >= 'a' && char <= 'z':
			out.WriteRune(char)
		case char >= '0' && char <= '9':
			out.WriteRune(char)
		case char == '-' || char == '_':
			out.WriteRune(char)
		case char == ' ':
			out.WriteRune('-')
		}
	}
	result := out.String()
	if result == "" {
		return "reporte-dte"
	}
	return result
}

func escapePDF(value string) string {
	value = strings.ReplaceAll(value, "\\", "\\\\")
	value = strings.ReplaceAll(value, "(", "\\(")
	value = strings.ReplaceAll(value, ")", "\\)")
	return value
}
