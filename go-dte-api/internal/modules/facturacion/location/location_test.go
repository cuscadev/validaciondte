package location

import "testing"

func TestDteMunicipioCode(t *testing.T) {
	tests := []struct {
		dept, muni, official, want string
	}{
		{"05", "30", "", "30"},
		{"06", "34", "", "34"},
		{"06", "14", "", "14"},
		{"06", "0614", "", "14"},
	}
	for _, tc := range tests {
		got := DteMunicipioCode(tc.dept, tc.muni, tc.official)
		if got != tc.want {
			t.Fatalf("DteMunicipioCode(%q, %q, %q) = %q, want %q", tc.dept, tc.muni, tc.official, got, tc.want)
		}
	}
}

func TestMapDteDireccionKeepsCat013Municipio(t *testing.T) {
	dept, muni, dist, _ := MapDteDireccion("06", "34", "03", "addr", "")
	if dept != "06" || muni != "34" || dist != "03" {
		t.Fatalf("MapDteDireccion = %q,%q,%q, want 06,34,03", dept, muni, dist)
	}
}

func TestMapDteDireccionSantaTecla(t *testing.T) {
	dept, muni, dist, _ := MapDteDireccion("05", "30", "01", "Santa Tecla", "")
	if dept != "05" || muni != "30" || dist != "01" {
		t.Fatalf("MapDteDireccion = %q,%q,%q, want 05,30,01", dept, muni, dist)
	}
}
