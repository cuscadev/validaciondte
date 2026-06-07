package signer

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/facturacion/signer/dto"
)

func TestSignUsesCertificateXMLAndReturnsCompactJWS(t *testing.T) {
	dir := t.TempDir()
	nit := "06141812151015"
	password := "clave-secreta"

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	encodedKey, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}

	sum := sha512.Sum512([]byte(password))
	certXML := `<CertificadoMH>
  <nit>` + nit + `</nit>
  <activo>true</activo>
  <privateKey>
    <algorithm>RSA</algorithm>
    <format>PKCS#8</format>
    <encodied>` + base64.StdEncoding.EncodeToString(encodedKey) + `</encodied>
    <clave>` + hex.EncodeToString(sum[:]) + `</clave>
  </privateKey>
</CertificadoMH>`

	if err := os.WriteFile(filepath.Join(dir, nit+".crt"), []byte(certXML), 0o600); err != nil {
		t.Fatalf("write cert: %v", err)
	}

	service := NewService(config.Config{HaciendaCertificateHome: dir})
	jws, err := service.Sign(dto.SignRequest{
		NIT:         nit,
		PasswordPri: password,
		DTEJSON:     json.RawMessage(`{"identificacion":{"tipoDte":"01"}}`),
	})
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}

	parts := strings.Split(jws, ".")
	if len(parts) != 3 {
		t.Fatalf("JWS parts = %d, want 3", len(parts))
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if !strings.Contains(string(payload), `"tipoDte": "01"`) {
		t.Fatalf("payload = %s", payload)
	}
}

func TestSignRejectsWrongPrivatePassword(t *testing.T) {
	dir := t.TempDir()
	nit := "06141812151015"

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	encodedKey, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}

	sum := sha512.Sum512([]byte("clave-correcta"))
	certXML := `<CertificadoMH>
  <nit>` + nit + `</nit>
  <activo>true</activo>
  <privateKey>
    <encodied>` + base64.StdEncoding.EncodeToString(encodedKey) + `</encodied>
    <clave>` + hex.EncodeToString(sum[:]) + `</clave>
  </privateKey>
</CertificadoMH>`

	if err := os.WriteFile(filepath.Join(dir, nit+".crt"), []byte(certXML), 0o600); err != nil {
		t.Fatalf("write cert: %v", err)
	}

	service := NewService(config.Config{HaciendaCertificateHome: dir})
	_, err = service.Sign(dto.SignRequest{
		NIT:         nit,
		PasswordPri: "clave-incorrecta",
		DTEJSON:     json.RawMessage(`{"identificacion":{"tipoDte":"01"}}`),
	})
	if err == nil || !strings.Contains(err.Error(), "passwordPri no valido") {
		t.Fatalf("Sign() error = %v, want passwordPri no valido", err)
	}
}
