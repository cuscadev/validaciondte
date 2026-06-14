package location

import "testing"

func TestDteMunicipioCode(t *testing.T) {
	tests := []struct {
		dept, muni, official, want string
	}{
		{"05", "01", "0511", "0511"},
		{"05", "01", "", "0501"},
		{"06", "14", "", "0614"},
		{"06", "01", "0614", "0614"},
		{"05", "0504", "", "0504"},
	}
	for _, tc := range tests {
		got := DteMunicipioCode(tc.dept, tc.muni, tc.official)
		if got != tc.want {
			t.Fatalf("DteMunicipioCode(%q, %q, %q) = %q, want %q", tc.dept, tc.muni, tc.official, got, tc.want)
		}
	}
}
