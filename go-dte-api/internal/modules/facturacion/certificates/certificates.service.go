package certificates

import (
	"bytes"
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	appcrypto "verificador-dte/go-dte-api/internal/common/crypto"
	"verificador-dte/go-dte-api/internal/common/config"
	"verificador-dte/go-dte-api/internal/modules/facturacion/certificates/dto"
	signerdomain "verificador-dte/go-dte-api/internal/modules/facturacion/signer/domain"
)

var nitRegex = regexp.MustCompile(`^\d{9}$|^\d{14}$`)

type Service struct {
	cfg     config.Config
	cache   *Cache
	storage *Storage
	pool    *pgxpool.Pool
}

func NewService(cfg config.Config, pool *pgxpool.Pool) *Service {
	return &Service{
		cfg:     cfg,
		cache:   NewCache(cfg.CertificateCacheTTL()),
		storage: NewStorage(cfg),
		pool:    pool,
	}
}

func (s *Service) Cache() *Cache {
	return s.cache
}

func ParseCertificateXML(data []byte) (*signerdomain.CertificateMH, error) {
	cleaned := bytes.TrimSpace(data)
	if len(cleaned) == 0 {
		return nil, errors.New("certificado vacio")
	}
	var cert signerdomain.CertificateMH
	if err := xml.Unmarshal(cleaned, &cert); err != nil {
		return nil, fmt.Errorf("certificado XML invalido: %w", err)
	}
	return &cert, nil
}

func verifyPrivatePassword(cert *signerdomain.CertificateMH, password string) bool {
	sum := sha512.Sum512([]byte(password))
	return strings.EqualFold(hex.EncodeToString(sum[:]), strings.TrimSpace(cert.PrivateKey.Clave))
}

func (s *Service) Upload(ctx context.Context, xmlData []byte, req dto.UploadRequest) (dto.UploadResponse, error) {
	nit := strings.TrimSpace(req.NIT)
	password := strings.TrimSpace(req.PasswordPri)
	if !nitRegex.MatchString(nit) {
		return dto.UploadResponse{}, errors.New("formato de NIT no valido")
	}
	if password == "" {
		return dto.UploadResponse{}, errors.New("passwordPri es requerido")
	}

	cert, err := ParseCertificateXML(xmlData)
	if err != nil {
		return dto.UploadResponse{}, err
	}
	if cert.NIT != "" && cert.NIT != nit {
		return dto.UploadResponse{}, fmt.Errorf("el certificado no corresponde al NIT %s", nit)
	}
	if !cert.Activo {
		return dto.UploadResponse{}, errors.New("el certificado no esta activo")
	}
	if !verifyPrivatePassword(cert, password) {
		return dto.UploadResponse{}, errors.New("passwordPri no valido")
	}

	objectPath := fmt.Sprintf("%d/%s.crt", req.EmisorID, nit)
	storagePath, err := s.storage.Upload(ctx, objectPath, xmlData)
	if err != nil {
		return dto.UploadResponse{}, err
	}

	if s.pool != nil && req.EmisorID > 0 {
		passwordHash, err := appcrypto.EncryptSecret([]byte(password), s.cfg.HaciendaCredentialsEncryptionKey)
		if err != nil {
			return dto.UploadResponse{}, err
		}
		_, err = s.pool.Exec(ctx, `
			UPDATE emisores
			SET certificado_path = $1,
			    certificado_password_hash = $2,
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
		`, storagePath, passwordHash, req.EmisorID)
		if err != nil {
			return dto.UploadResponse{}, err
		}
	}

	s.cache.Set(nit, cert)
	return dto.UploadResponse{
		Success: true,
		NIT:     nit,
		Activo:  cert.Activo,
		Path:    storagePath,
	}, nil
}

func (s *Service) Warmup(ctx context.Context, req dto.WarmupRequest) (dto.WarmupResponse, error) {
	nit := strings.TrimSpace(req.NIT)
	if nit == "" && s.pool != nil {
		_ = s.pool.QueryRow(ctx, `
			SELECT nit FROM emisores WHERE id = $1 AND activo = TRUE LIMIT 1
		`, req.EmisorID).Scan(&nit)
	}
	if nit == "" && req.FirebaseUID != "" && s.pool != nil {
		_ = s.pool.QueryRow(ctx, `
			SELECT e.nit
			FROM usuarios u
			INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
			INNER JOIN emisores e ON e.id = ue.emisor_id
			WHERE u.firebase_uid = $1 AND e.activo = TRUE
			ORDER BY CASE ue.rol WHEN 'propietario' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END
			LIMIT 1
		`, req.FirebaseUID).Scan(&nit)
	}
	if !nitRegex.MatchString(nit) {
		return dto.WarmupResponse{}, errors.New("NIT no disponible para warmup")
	}

	if cached := s.cache.Get(nit); cached != nil {
		return dto.WarmupResponse{Success: true, NIT: nit, Cached: true}, nil
	}

	cert, err := s.LoadCertificate(ctx, nit)
	if err != nil {
		return dto.WarmupResponse{}, err
	}
	if cert == nil {
		return dto.WarmupResponse{}, errors.New("certificado no encontrado")
	}
	s.cache.Set(nit, cert)
	return dto.WarmupResponse{Success: true, NIT: nit, Cached: true}, nil
}

func (s *Service) LoadCertificate(ctx context.Context, nit string) (*signerdomain.CertificateMH, error) {
	if cached := s.cache.Get(nit); cached != nil {
		return cached, nil
	}

	var storagePath string
	if s.pool != nil {
		_ = s.pool.QueryRow(ctx, `
			SELECT certificado_path FROM emisores WHERE nit = $1 AND activo = TRUE LIMIT 1
		`, nit).Scan(&storagePath)
	}

	if strings.TrimSpace(storagePath) != "" {
		data, err := s.storage.Download(ctx, storagePath)
		if err == nil {
			cert, parseErr := ParseCertificateXML(data)
			if parseErr == nil {
				s.cache.Set(nit, cert)
				return cert, nil
			}
		}
	}

	for _, dir := range s.certificateDirs() {
		for _, name := range certificateFileNames(nit) {
			path := filepath.Join(dir, name)
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}
			cert, parseErr := ParseCertificateXML(data)
			if parseErr != nil {
				return nil, parseErr
			}
			s.cache.Set(nit, cert)
			return cert, nil
		}
	}

	return nil, nil
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
	}
	return dirs
}

func certificateFileNames(nit string) []string {
	return []string{nit + ".crt", "Certificado_" + nit + ".crt", "certificado_" + nit + ".crt"}
}

func (s *Service) ResolvePassword(ctx context.Context, nit, provided string) (string, error) {
	password := strings.TrimSpace(provided)
	if password != "" {
		return password, nil
	}
	if s.pool == nil {
		return "", errors.New("passwordPri es requerida")
	}

	var encrypted string
	err := s.pool.QueryRow(ctx, `
		SELECT certificado_password_hash
		FROM emisores
		WHERE nit = $1 AND activo = TRUE
		LIMIT 1
	`, strings.TrimSpace(nit)).Scan(&encrypted)
	if err != nil || strings.TrimSpace(encrypted) == "" {
		return "", errors.New("passwordPri es requerida")
	}

	plain, err := appcrypto.DecryptSecret(encrypted, s.cfg.HaciendaCredentialsEncryptionKey)
	if err != nil {
		return "", errors.New("no se pudo descifrar la clave del certificado")
	}
	password = strings.TrimSpace(string(plain))
	if password == "" {
		return "", errors.New("passwordPri es requerida")
	}
	return password, nil
}
