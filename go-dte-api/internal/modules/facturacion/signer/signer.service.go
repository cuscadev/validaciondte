package signer

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"verificador-dte/go-dte-api/internal/common/config"
	certificates "verificador-dte/go-dte-api/internal/modules/facturacion/certificates"
	"verificador-dte/go-dte-api/internal/modules/facturacion/signer/domain"
	"verificador-dte/go-dte-api/internal/modules/facturacion/signer/dto"
)

var nitRegex = regexp.MustCompile(`^\d{9}$|^\d{14}$`)

type Service struct {
	cfg config.Config
}

func NewService(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) Sign(req dto.SignRequest) (string, error) {
	nit := strings.TrimSpace(req.NIT)
	password, err := s.resolvePassword(nit, req.PasswordPri)
	if err != nil {
		return "", err
	}
	if len(bytes.TrimSpace(req.DTEJSON)) == 0 {
		return "", errors.New("dteJson es requerido")
	}

	payload, err := normalizeJSON(req.DTEJSON)
	if err != nil {
		return "", fmt.Errorf("JSON invalido: %w", err)
	}

	cert, err := s.loadCertificate(nit)
	if err != nil {
		return "", err
	}
	if cert == nil {
		return "", errors.New("no existe certificado para el NIT: " + nit)
	}
	if cert.NIT != "" && cert.NIT != nit {
		return "", fmt.Errorf("el certificado no corresponde al NIT solicitado. Esperado: %s, Encontrado: %s", nit, cert.NIT)
	}
	if !cert.Activo {
		return "", errors.New("el certificado no esta activo")
	}
	if !verifyPrivatePassword(cert, password) {
		return "", errors.New("passwordPri no valido")
	}

	privateKey, err := parseRSAPrivateKey([]byte(cert.PrivateKey.Encodied))
	if err != nil {
		return "", err
	}

	return signCompactRS512(payload, privateKey)
}

func (s *Service) SignBatch(req dto.SignBatchRequest) (dto.SignBatchResponse, error) {
	nit := strings.TrimSpace(req.NIT)
	password, err := s.resolvePassword(nit, req.PasswordPri)
	if err != nil {
		return dto.SignBatchResponse{}, err
	}
	if len(req.Documentos) == 0 {
		return dto.SignBatchResponse{}, errors.New("documentos es requerido")
	}

	cert, err := s.loadCertificate(nit)
	if err != nil {
		return dto.SignBatchResponse{}, err
	}
	if cert == nil {
		return dto.SignBatchResponse{}, errors.New("no existe certificado para el NIT: " + nit)
	}
	if cert.NIT != "" && cert.NIT != nit {
		return dto.SignBatchResponse{}, fmt.Errorf("el certificado no corresponde al NIT solicitado. Esperado: %s, Encontrado: %s", nit, cert.NIT)
	}
	if !cert.Activo {
		return dto.SignBatchResponse{}, errors.New("el certificado no esta activo")
	}
	if !verifyPrivatePassword(cert, password) {
		return dto.SignBatchResponse{}, errors.New("passwordPri no valido")
	}

	privateKey, err := parseRSAPrivateKey([]byte(cert.PrivateKey.Encodied))
	if err != nil {
		return dto.SignBatchResponse{}, err
	}

	out := make([]dto.SignBatchDocumentResponse, 0, len(req.Documentos))
	allOK := true
	for index, document := range req.Documentos {
		item := dto.SignBatchDocumentResponse{
			ID: document.ID,
		}
		if strings.TrimSpace(item.ID) == "" {
			item.ID = fmt.Sprintf("%d", index+1)
		}
		if len(bytes.TrimSpace(document.DTEJSON)) == 0 {
			item.Error = "dteJson es requerido"
			allOK = false
			out = append(out, item)
			continue
		}

		payload, err := normalizeJSON(document.DTEJSON)
		if err != nil {
			item.Error = "JSON invalido: " + err.Error()
			allOK = false
			out = append(out, item)
			continue
		}

		firma, err := signCompactRS512(payload, privateKey)
		if err != nil {
			item.Error = err.Error()
			allOK = false
			out = append(out, item)
			continue
		}

		item.Success = true
		item.Firma = firma
		item.CodigoGeneracion = extractCodigoGeneracion(document.DTEJSON)
		out = append(out, item)
	}

	return dto.SignBatchResponse{
		Success:    allOK,
		Documentos: out,
	}, nil
}

func (s *Service) loadCertificate(nit string) (*domain.CertificateMH, error) {
	if certService := certificates.SharedService(); certService != nil {
		cert, err := certService.LoadCertificate(context.Background(), nit)
		if err != nil {
			return nil, err
		}
		if cert != nil {
			return cert, nil
		}
	}

	for _, dir := range s.certificateDirs() {
		for _, name := range certificateFileNames(nit) {
			path := filepath.Join(dir, name)
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}
			cert, err := certificates.ParseCertificateXML(data)
			if err != nil {
				return nil, err
			}
			if certService := certificates.SharedService(); certService != nil {
				certService.Cache().Set(nit, cert)
			}
			return cert, nil
		}
	}

	return nil, nil
}

func (s *Service) resolvePassword(nit, provided string) (string, error) {
	nit = strings.TrimSpace(nit)
	if nit == "" {
		return "", errors.New("NIT es requerido")
	}
	if !nitRegex.MatchString(nit) {
		return "", errors.New("formato de NIT no valido")
	}
	if certService := certificates.SharedService(); certService != nil {
		if password, err := certService.ResolvePassword(context.Background(), nit, provided); err == nil {
			return password, nil
		} else if strings.TrimSpace(provided) != "" {
			return "", err
		}
	}
	password := strings.TrimSpace(provided)
	if password == "" {
		return "", errors.New("clave privada es requerida")
	}
	return password, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *Service) certificateDirs() []string {
	dirs := []string{}
	for _, dir := range strings.Split(s.cfg.HaciendaCertificateHome, string(os.PathListSeparator)) {
		if trimmed := strings.TrimSpace(dir); trimmed != "" {
			dirs = append(dirs, trimmed)
		}
	}
	if cwd, err := os.Getwd(); err == nil {
		dirs = append(dirs, filepath.Join(cwd, "uploads"))
		dirs = append(dirs, filepath.Join(cwd, "ejemplodecertificado"))
		dirs = append(dirs, filepath.Join(cwd, "Ejemplodecertificado"))
		dirs = append(dirs, filepath.Join(cwd, "Ejemplodeceritifcado"))
		dirs = append(dirs, filepath.Join(cwd, "..", "ejemplodecertificado"))
		dirs = append(dirs, filepath.Join(cwd, "..", "Ejemplodecertificado"))
		dirs = append(dirs, filepath.Join(cwd, "..", "Ejemplodeceritifcado"))
		dirs = append(dirs, filepath.Join(cwd, "..", "Documentacion de hacienda", "dte-firmador", "dte-firmador", "dockerSinSSL", "docker", "certificado"))
		dirs = append(dirs, filepath.Join(cwd, "..", "Documentacion de hacienda", "dte-firmador", "dte-firmador", "dockerConSSL", "docker", "certificado"))
	}
	return dirs
}

func certificateFileNames(nit string) []string {
	return []string{
		nit + ".crt",
		"Certificado_" + nit + ".crt",
		"certificado_" + nit + ".crt",
	}
}

func verifyPrivatePassword(cert *domain.CertificateMH, password string) bool {
	sum := sha512.Sum512([]byte(password))
	return strings.EqualFold(hex.EncodeToString(sum[:]), strings.TrimSpace(cert.PrivateKey.Clave))
}

func parseRSAPrivateKey(encoded []byte) (*rsa.PrivateKey, error) {
	if len(encoded) == 0 {
		return nil, errors.New("llave privada vacia")
	}

	der, decodeErr := base64.StdEncoding.DecodeString(stripWhitespace(string(encoded)))
	if decodeErr != nil {
		der = encoded
	}

	key, err := x509.ParsePKCS8PrivateKey(der)
	if err == nil {
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("la llave privada no es RSA")
		}
		return rsaKey, nil
	}

	if rsaKey, pkcs1Err := x509.ParsePKCS1PrivateKey(der); pkcs1Err == nil {
		return rsaKey, nil
	}

	return nil, fmt.Errorf("no se pudo parsear llave privada PKCS#8: %w", err)
}

func stripWhitespace(value string) string {
	return strings.Join(strings.Fields(value), "")
}

func signCompactRS512(payload []byte, key *rsa.PrivateKey) (string, error) {
	header := []byte(`{"alg":"RS512"}`)
	encodedHeader := base64.RawURLEncoding.EncodeToString(header)
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signingInput := encodedHeader + "." + encodedPayload

	digest := sha512.Sum512([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA512, digest[:])
	if err != nil {
		return "", err
	}

	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func normalizeJSON(raw json.RawMessage) ([]byte, error) {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}

	// Jackson's default-pretty-printer signs a formatted JSON string. Indented JSON is stable
	// enough for Hacienda because the JWS payload itself is what is submitted and verified.
	return json.MarshalIndent(value, "", "  ")
}

func extractCodigoGeneracion(raw json.RawMessage) string {
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		return ""
	}
	identificacion, ok := body["identificacion"].(map[string]any)
	if !ok {
		return ""
	}
	value, ok := identificacion["codigoGeneracion"].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
}
