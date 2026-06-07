package signer

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"verificador-dte/go-dte-api/internal/common/config"
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
	password := strings.TrimSpace(req.PasswordPri)

	if nit == "" {
		return "", errors.New("NIT es requerido")
	}
	if !nitRegex.MatchString(nit) {
		return "", errors.New("formato de NIT no valido")
	}
	if password == "" {
		return "", errors.New("clave privada es requerida")
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
	fmt.Printf("[DEBUG] Certificado activo: %v\n", cert.Activo)
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

func (s *Service) loadCertificate(nit string) (*domain.CertificateMH, error) {
	fmt.Printf("[DEBUG] Buscando certificado para NIT: %s\n", nit)
	fmt.Printf("[DEBUG] Directorios de búsqueda:\n")
	for i, dir := range s.certificateDirs() {
		fmt.Printf("[DEBUG]   %d: %s\n", i, dir)
	}
	
	for _, dir := range s.certificateDirs() {
		for _, name := range certificateFileNames(nit) {
			path := filepath.Join(dir, name)
			fmt.Printf("[DEBUG] Buscando: %s\n", path)
			data, err := os.ReadFile(path)
			if err != nil {
				fmt.Printf("[DEBUG]   No encontrado: %v\n", err)
				continue
			}

			fmt.Printf("[DEBUG] ✓ Archivo encontrado! Tamaño: %d bytes\n", len(data))
			
			if len(data) == 0 {
				fmt.Printf("[DEBUG] ⚠️  Advertencia: Archivo vacío!\n")
				continue
			}

			// Limpiar espacios en blanco y saltos de línea alrededor del contenido
			cleanedData := bytes.TrimSpace(data)
			fmt.Printf("[DEBUG] Primeros 200 chars del certificado:\n%s\n", string(cleanedData[:min(200, len(cleanedData))]))

			var cert domain.CertificateMH
			if err := xml.Unmarshal(cleanedData, &cert); err != nil {
				fmt.Printf("[DEBUG]   Error al parsear XML: %v\n", err)
				fmt.Printf("[DEBUG]   Contenido completo del archivo:\n%s\n", string(cleanedData))
				return nil, fmt.Errorf("certificado XML invalido: %w", err)
			}
			fmt.Printf("[DEBUG] ✓ XML parseado correctamente\n")
			fmt.Printf("[DEBUG]   NIT en certificado: %s\n", cert.NIT)
			fmt.Printf("[DEBUG]   Activo: %v\n", cert.Activo)
			if len(cert.PrivateKey.Clave) > 0 {
				fmt.Printf("[DEBUG]   PrivateKey.Clave (primeros 20 chars): %s...\n", cert.PrivateKey.Clave[:min(20, len(cert.PrivateKey.Clave))])
			}
			return &cert, nil
		}
	}

	return nil, nil // Retorna nil sin error si no encuentra
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
