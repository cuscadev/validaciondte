package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"errors"
	"strings"

	"golang.org/x/crypto/scrypt"
)

const scryptSalt = "email-credentials-salt"

func DecryptSecret(rawKey, payload string) (string, error) {
	key, err := deriveKey(rawKey)
	if err != nil {
		return "", err
	}

	parts := strings.Split(payload, ".")
	if len(parts) != 3 {
		return "", errors.New("credencial cifrada invalida")
	}

	iv, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return "", err
	}
	tag, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", err
	}
	data, err := base64.StdEncoding.DecodeString(parts[2])
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(iv) != gcm.NonceSize() {
		return "", errors.New("IV invalido")
	}

	ciphertext := append(data, tag...)
	plain, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func deriveKey(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("falta EMAIL_CREDENTIALS_ENCRYPTION_KEY")
	}

	if decoded, err := base64.StdEncoding.DecodeString(raw); err == nil && len(decoded) == 32 {
		return decoded, nil
	}

	return scrypt.Key([]byte(raw), []byte(scryptSalt), 16384, 8, 1, 32)
}
