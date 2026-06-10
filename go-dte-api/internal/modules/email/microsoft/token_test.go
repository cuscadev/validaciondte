package microsoft

import "testing"

func TestFormatOAuthError(t *testing.T) {
	if got := formatOAuthError("AADSTS65001: consent"); got != "se requiere consentimiento del administrador de Microsoft 365" {
		t.Fatalf("unexpected: %q", got)
	}
	if got := formatOAuthError("invalid_grant"); got != "autorizacion expirada o revocada" {
		t.Fatalf("unexpected: %q", got)
	}
}
