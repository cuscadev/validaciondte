package location

import "strings"

// DteMunicipioCode normalizes the CAT-013 municipio code for emisor.direccion.municipio.
func DteMunicipioCode(_departamento, municipio, _codigoDte string) string {
	return LeftPadDigits(municipio, 2)
}

func MapDteDireccion(departamento, municipio, distrito, complemento, _codigoDte string) (string, string, string, string) {
	dept := LeftPadDigits(departamento, 2)
	muni := LeftPadDigits(municipio, 2)
	dist := LeftPadDigits(distrito, 2)
	return dept, muni, dist, strings.TrimSpace(complemento)
}

func MapEmisorDteDireccion(departamento, municipio, distrito, complemento, codigoDte string) (string, string, string) {
	dept, muni, _, comp := MapDteDireccion(departamento, municipio, distrito, complemento, codigoDte)
	return dept, muni, comp
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
