package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
)

func deriveKey(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

func EncryptSecret(plain []byte, secret string) (string, error) {
	if len(secret) < 16 {
		return "", errors.New("encryption secret demasiado corto")
	}
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, plain, nil)
	payload := append(nonce, ciphertext...)
	return base64.StdEncoding.EncodeToString(payload), nil
}

func DecryptSecret(encoded string, secret string) ([]byte, error) {
	if len(secret) < 16 {
		return nil, errors.New("encryption secret demasiado corto")
	}
	payload, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(payload) < gcm.NonceSize() {
		return nil, errors.New("payload cifrado invalido")
	}
	nonce := payload[:gcm.NonceSize()]
	ciphertext := payload[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}
