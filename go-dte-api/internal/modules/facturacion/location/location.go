package location

import "strings"

// DteMunicipioCode builds the CAT-013 value for DTE JSON (dept 2 digits + municipio 2 digits).
func DteMunicipioCode(departamento, municipio string) string {
	dept := LeftPadDigits(departamento, 2)
	digits := DigitsOnly(municipio)
	if dept == "" || digits == "" {
		return LeftPadDigits(municipio, 4)
	}
	if len(digits) >= 4 {
		return digits[len(digits)-4:]
	}
	return dept + LeftPadDigits(municipio, 2)
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

func MapDteDireccion(departamento, municipio, distrito, complemento string) (string, string, string, string) {
	dept := LeftPadDigits(departamento, 2)
	return dept, DteMunicipioCode(dept, municipio), LeftPadDigits(distrito, 2), strings.TrimSpace(complemento)
}
