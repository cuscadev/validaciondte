package location

import "testing"

func TestDteMunicipioCode(t *testing.T) {
	tests := []struct {
		dept, muni, want string
	}{
		{"06", "14", "0614"},
		{"05", "04", "0504"},
		{"6", "4", "0604"},
		{"06", "0614", "0614"},
		{"05", "0504", "0504"},
	}
	for _, tc := range tests {
		got := DteMunicipioCode(tc.dept, tc.muni)
		if got != tc.want {
			t.Fatalf("DteMunicipioCode(%q, %q) = %q, want %q", tc.dept, tc.muni, got, tc.want)
		}
	}
}
