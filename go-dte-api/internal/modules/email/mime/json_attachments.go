package mimeutil

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"strings"

	"github.com/emersion/go-message/mail"
)

type JSONAttachment struct {
	MessageUID       string
	MessageIDHeader  string
	AttachmentPartID string
	FileName         string
	MimeType         string
	EmailSubject     string
	EmailDate        string
	Buffer           []byte
}

func IsJSONAttachment(fileName, mimeType string) bool {
	lower := strings.ToLower(fileName)
	if strings.HasSuffix(lower, ".json") {
		return true
	}
	return strings.Contains(strings.ToLower(mimeType), "json")
}

func attachmentPartID(fileName string, checksum string) string {
	if len(checksum) > 16 {
		checksum = checksum[:16]
	}
	return fmt.Sprintf("%s:%s", fileName, checksum)
}

type attachmentInput struct {
	MessageUID      string
	MessageIDHeader string
	EmailSubject    string
	EmailDate       string
}

func ExtractJSONAttachments(input struct {
	MessageUID      string
	MessageIDHeader string
	Source          []byte
	EmailSubject    string
	EmailDate       string
}) ([]JSONAttachment, error) {
	reader, err := mail.CreateReader(bytes.NewReader(input.Source))
	if err != nil {
		return nil, err
	}
	base := attachmentInput{
		MessageUID:      input.MessageUID,
		MessageIDHeader: input.MessageIDHeader,
		EmailSubject:    input.EmailSubject,
		EmailDate:       input.EmailDate,
	}
	return collectJSONAttachments(reader, base)
}

func collectJSONAttachments(reader *mail.Reader, base attachmentInput) ([]JSONAttachment, error) {
	var out []JSONAttachment
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		nested, err := attachmentsFromPart(part, base)
		if err != nil {
			return nil, err
		}
		out = append(out, nested...)
	}
	return out, nil
}

func attachmentsFromPart(part *mail.Part, base attachmentInput) ([]JSONAttachment, error) {
	contentType := part.Header.Get("Content-Type")
	mediaType, params, _ := mime.ParseMediaType(contentType)
	if strings.HasPrefix(mediaType, "multipart/") {
		nestedReader, err := mail.CreateReader(part.Body)
		if err != nil {
			return nil, err
		}
		return collectJSONAttachments(nestedReader, base)
	}

	fileName := ""
	mimeType := contentType
	switch h := part.Header.(type) {
	case *mail.AttachmentHeader:
		fileName, _ = h.Filename()
	case *mail.InlineHeader:
		if _, p, err := h.ContentDisposition(); err == nil {
			fileName = p["filename"]
		}
		if fileName == "" {
			_, p, _ := h.ContentType()
			fileName = p["name"]
		}
	default:
		fileName = params["name"]
	}

	if fileName == "" {
		fileName = mimeType
	}
	if !IsJSONAttachment(fileName, mimeType) {
		return nil, nil
	}

	body, err := io.ReadAll(part.Body)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(body)
	checksum := hex.EncodeToString(sum[:])
	return []JSONAttachment{{
		MessageUID:       base.MessageUID,
		MessageIDHeader:  base.MessageIDHeader,
		AttachmentPartID: attachmentPartID(fileName, checksum),
		FileName:         fileName,
		MimeType:         mimeType,
		EmailSubject:     base.EmailSubject,
		EmailDate:        base.EmailDate,
		Buffer:           body,
	}}, nil
}

func SHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
