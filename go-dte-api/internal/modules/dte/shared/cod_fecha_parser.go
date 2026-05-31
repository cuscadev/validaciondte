package shared

import (
	"bytes"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

var ymdPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

type CodFechaRow struct {
	CodGen   string
	FechaYMD string
}

func ParseCodFechaFromFile(filename string, data []byte) []CodFechaRow {
	name := strings.ToLower(filename)
	if strings.HasSuffix(name, ".xlsx") || strings.HasSuffix(name, ".xlsm") || strings.HasSuffix(name, ".xls") {
		return parseCodFechaXLSX(data)
	}
	return parseCodFechaCSV(decodeText(data))
}

func parseCodFechaCSV(text string) []CodFechaRow {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	out := []CodFechaRow{}

	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := splitCells(line)
		if len(parts) < 2 {
			continue
		}
		codGen := strings.TrimSpace(parts[0])
		fechaRaw := strings.TrimSpace(parts[1])

		if i == 0 && !IsUUID(codGen) {
			if strings.Contains(strings.ToLower(codGen), "cod") {
				continue
			}
		}
		if !IsUUID(codGen) {
			continue
		}
		fechaYMD, ok := TryParseFechaFlexible(fechaRaw)
		if !ok {
			continue
		}
		out = append(out, CodFechaRow{
			CodGen:   strings.ToUpper(codGen),
			FechaYMD: fechaYMD,
		})
	}
	return out
}

func parseCodFechaXLSX(data []byte) []CodFechaRow {
	file, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil
	}
	defer file.Close()

	sheets := file.GetSheetList()
	if len(sheets) == 0 {
		return nil
	}

	rows, err := file.GetRows(sheets[0])
	if err != nil {
		return nil
	}

	out := []CodFechaRow{}
	for i, row := range rows {
		if len(row) < 2 {
			continue
		}
		codGen := strings.TrimSpace(row[0])
		fechaRaw := strings.TrimSpace(row[1])

		if i == 0 && !IsUUID(codGen) {
			if strings.Contains(strings.ToLower(codGen), "cod") {
				continue
			}
		}
		if !IsUUID(codGen) {
			continue
		}
		fechaYMD, ok := TryParseFechaFlexible(fechaRaw)
		if !ok {
			continue
		}
		out = append(out, CodFechaRow{
			CodGen:   strings.ToUpper(codGen),
			FechaYMD: fechaYMD,
		})
	}
	return out
}

func TryParseFechaFlexible(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}

	if matched, ok := normalizeYMD(raw); ok {
		return matched, true
	}

	if IsDMY(raw) {
		ymd := DMYToYMD(raw)
		if ymd != "" {
			return ymd, true
		}
	}

	if serial, err := strconv.ParseFloat(raw, 64); err == nil {
		if parsed, ok := excelSerialToYMD(serial); ok {
			return parsed, true
		}
	}

	if parsed, err := time.Parse("2006-01-02", raw); err == nil {
		return parsed.Format("2006-01-02"), true
	}

	if parsed, err := time.Parse("02/01/2006", strings.ReplaceAll(raw, "-", "/")); err == nil {
		return parsed.Format("2006-01-02"), true
	}

	return "", false
}

func normalizeYMD(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if ymdPattern.MatchString(value) {
		return value, true
	}
	value = strings.ReplaceAll(value, "/", "-")
	if ymdPattern.MatchString(value) {
		return value, true
	}
	return "", false
}

func excelSerialToYMD(serial float64) (string, bool) {
	if serial < 20000 || serial > 80000 {
		return "", false
	}
	base := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
	parsed := base.Add(time.Duration(serial*86400) * time.Second)
	return parsed.Format("2006-01-02"), true
}

func CodFechaRowsToLinks(rows []CodFechaRow, ambiente string) []string {
	if ambiente == "" {
		ambiente = "01"
	}
	links := make([]string, 0, len(rows))
	for _, row := range rows {
		links = append(links, BuildConsultaURL(row.CodGen, row.FechaYMD, ambiente))
	}
	return links
}
