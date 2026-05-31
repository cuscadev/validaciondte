package shared

import "testing"

func TestTryParseFechaFlexible(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"2026-01-15", "2026-01-15", true},
		{"15/01/2026", "2026-01-15", true},
		{"invalid", "", false},
	}

	for _, tc := range cases {
		got, ok := TryParseFechaFlexible(tc.in)
		if ok != tc.ok || got != tc.want {
			t.Fatalf("TryParseFechaFlexible(%q) = (%q, %v), want (%q, %v)", tc.in, got, ok, tc.want, tc.ok)
		}
	}
}

func TestParseCodFechaCSV(t *testing.T) {
	text := "codGen,fecha\n12345678-1234-1234-1234-123456789ABC,2026-01-15\n87654321-4321-4321-4321-CBA987654321,15/01/2026\n"
	rows := parseCodFechaCSV(text)
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}
	if rows[0].FechaYMD != "2026-01-15" {
		t.Fatalf("unexpected first date: %s", rows[0].FechaYMD)
	}
}
