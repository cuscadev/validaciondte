package location

import "strings"

// DteMunicipioCode returns the 2-digit CAT-013 municipio suffix for DTE JSON.
func DteMunicipioCode(_departamento, municipio, codigoDte string) string {
	if digits := DigitsOnly(codigoDte); len(digits) >= 4 {
		return LeftPadDigits(digits[len(digits)-2:], 2)
	}
	if digits := DigitsOnly(municipio); len(digits) >= 4 {
		return LeftPadDigits(digits[len(digits)-2:], 2)
	}
	return LeftPadDigits(municipio, 2)
}

func DigitsOnly(value string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(value) {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func LeftPadDigits(value string, width int) string {
	clean := DigitsOnly(value)
	if clean == "" {
		return ""
	}
	if len(clean) > width {
		return clean[len(clean)-width:]
	}
	for len(clean) < width {
		clean = "0" + clean
	}
	return clean
}

func MapDteDireccion(departamento, municipio, distrito, complemento, codigoDte string) (string, string, string, string) {
	dept := LeftPadDigits(departamento, 2)
	return dept, DteMunicipioCode(dept, municipio, codigoDte), LeftPadDigits(distrito, 2), strings.TrimSpace(complemento)
}

func MapEmisorDteDireccion(departamento, municipio, complemento, codigoDte string) (string, string, string) {
	dept := LeftPadDigits(departamento, 2)
	return dept, DteMunicipioCode(dept, municipio, codigoDte), strings.TrimSpace(complemento)
}
