package domain

import (
	"encoding/base64"
	"encoding/xml"
	"strconv"
	"strings"
)

type CertificateMH struct {
	XMLName    xml.Name `xml:"CertificadoMH"`
	NIT        string   `xml:"nit"`
	PublicKey  Key      `xml:"publicKey"`
	PrivateKey Key      `xml:"privateKey"`
	Activo     bool     `xml:"activo"`
}

type Key struct {
	KeyType   string       `xml:"keyType"`
	Algorithm string       `xml:"algorithm"`
	Encodied  EncodedBytes `xml:"encodied"`
	Format    string       `xml:"format"`
	Clave     string       `xml:"clave"`
}

type EncodedBytes []byte

func (b *EncodedBytes) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	var raw string
	if err := d.DecodeElement(&raw, &start); err != nil {
		return err
	}

	value := strings.TrimSpace(raw)
	if value == "" {
		*b = nil
		return nil
	}

	if decoded, err := base64.StdEncoding.DecodeString(value); err == nil {
		*b = decoded
		return nil
	}

	// Some serializers emit byte arrays as "[1, 2, 3]"; support that for migration safety.
	if strings.HasPrefix(value, "[") && strings.HasSuffix(value, "]") {
		parts := strings.Split(strings.Trim(value, "[]"), ",")
		out := make([]byte, 0, len(parts))
		for _, part := range parts {
			n, err := strconv.Atoi(strings.TrimSpace(part))
			if err != nil {
				*b = []byte(value)
				return nil
			}
			out = append(out, byte(n))
		}
		*b = out
		return nil
	}

	*b = []byte(value)
	return nil
}
