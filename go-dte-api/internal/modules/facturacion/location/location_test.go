package location

import "testing"

func TestDteMunicipioCode(t *testing.T) {
	tests := []struct {
		dept, muni, official, want string
	}{
		{"05", "01", "0511", "11"},
		{"05", "01", "", "01"},
		{"06", "14", "", "14"},
		{"06", "0614", "", "14"},
		{"04", "35", "0435", "35"},
	}
	for _, tc := range tests {
		got := DteMunicipioCode(tc.dept, tc.muni, tc.official)
		if got != tc.want {
			t.Fatalf("DteMunicipioCode(%q, %q, %q) = %q, want %q", tc.dept, tc.muni, tc.official, got, tc.want)
		}
	}
}
