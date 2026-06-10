package imaputil

import (
	"bytes"
	"strings"
	"testing"

	"github.com/emersion/go-imap"
)

func TestGmailRawSearchCommandUsesRawAtom(t *testing.T) {
	cmd := (&gmailRawSearch{query: `after:2025/01/01 before:2025/02/01 has:attachment filename:json (factura OR DTE)`}).Command()
	if cmd.Name != "SEARCH" {
		t.Fatalf("expected SEARCH, got %q", cmd.Name)
	}
	if len(cmd.Arguments) != 2 {
		t.Fatalf("expected 2 arguments, got %d", len(cmd.Arguments))
	}
	raw, ok := cmd.Arguments[0].(imap.RawString)
	if !ok || string(raw) != "X-GM-RAW" {
		t.Fatalf("expected RawString X-GM-RAW, got %#v", cmd.Arguments[0])
	}
	query, ok := cmd.Arguments[1].(string)
	if !ok || !strings.Contains(query, "has:attachment filename:json") {
		t.Fatalf("expected query string, got %#v", cmd.Arguments[1])
	}
}

func TestBuildGmailRawQueryFormat(t *testing.T) {
	query, err := BuildGmailRawQuery("2025-01-15", "2025-01-31")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(query, "after:2025/01/15") {
		t.Fatalf("missing after date: %q", query)
	}
	if !strings.Contains(query, "before:2025/02/01") {
		t.Fatalf("missing before date (day after dateTo): %q", query)
	}
	if !strings.Contains(query, "has:attachment filename:json") {
		t.Fatalf("missing attachment filter: %q", query)
	}
	if strings.Contains(query, `"credito fiscal"`) {
		t.Fatalf("query should not contain nested quotes: %q", query)
	}
}

func TestGmailRawSearchWireFormat(t *testing.T) {
	query := `after:2025/01/01 before:2025/02/01 has:attachment filename:json (factura OR DTE)`
	cmd := (&gmailRawSearch{query: query}).Command()

	var buf bytes.Buffer
	w := imap.NewWriter(&buf)
	if err := cmd.WriteTo(w); err != nil {
		t.Fatal(err)
	}
	if err := w.Flush(); err != nil {
		t.Fatal(err)
	}

	wire := buf.String()
	if strings.Contains(wire, `"X-GM-RAW"`) {
		t.Fatalf("X-GM-RAW must be an atom, not quoted; wire: %q", wire)
	}
	if !strings.Contains(wire, "X-GM-RAW") {
		t.Fatalf("missing X-GM-RAW atom; wire: %q", wire)
	}
	if !strings.Contains(wire, "after:2025/01/01") {
		t.Fatalf("missing quoted query; wire: %q", wire)
	}
}

func TestIsGmailProvider(t *testing.T) {
	if !IsGmailProvider("gmail", "imap.gmail.com") {
		t.Fatal("expected gmail provider")
	}
	if !IsGmailProvider("", "imap.gmail.com") {
		t.Fatal("expected gmail from host")
	}
	if IsGmailProvider("yahoo", "imap.mail.yahoo.com") {
		t.Fatal("yahoo should not be gmail")
	}
}
