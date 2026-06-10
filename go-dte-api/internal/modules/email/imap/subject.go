package imaputil

import (
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var subjectKeywords = []string{
	"factura",
	"credito fiscal",
	"crédito fiscal",
	"nota de credito",
	"nota de crédito",
	"nota de debito",
	"nota de débito",
	"dte",
	"ccf",
}

func normalizeSubject(subject string) string {
	subject = strings.TrimSpace(subject)
	if subject == "" {
		return ""
	}
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	normalized, _, _ := transform.String(t, subject)
	return strings.ToLower(normalized)
}

func MatchesEmailSubject(subject string) bool {
	normalized := normalizeSubject(subject)
	if normalized == "" {
		return false
	}
	for _, keyword := range subjectKeywords {
		if strings.Contains(normalized, normalizeSubject(keyword)) {
			return true
		}
	}
	return false
}
