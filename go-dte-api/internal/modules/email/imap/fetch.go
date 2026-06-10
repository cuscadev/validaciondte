package imaputil

import (
	"bytes"
	"fmt"
	"io"
	"time"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
)

type EnvelopeInfo struct {
	Subject         string
	Date            string
	MessageIDHeader string
}

type MessageSource struct {
	Source          []byte
	EnvelopeSubject string
	EnvelopeDate    string
	MessageIDHeader string
}

func FetchEnvelopes(c *client.Client, uids []uint32) (map[uint32]EnvelopeInfo, error) {
	if len(uids) == 0 {
		return map[uint32]EnvelopeInfo{}, nil
	}

	seqSet := new(imap.SeqSet)
	seqSet.AddNum(uids...)
	items := []imap.FetchItem{imap.FetchEnvelope, imap.FetchUid}
	messages := make(chan *imap.Message, len(uids))

	done := make(chan error, 1)
	go func() {
		done <- c.UidFetch(seqSet, items, messages)
	}()

	out := make(map[uint32]EnvelopeInfo, len(uids))
	for msg := range messages {
		if msg.Uid == 0 || msg.Envelope == nil {
			continue
		}
		date := time.Now().UTC().Format(time.RFC3339Nano)
		if !msg.Envelope.Date.IsZero() {
			date = msg.Envelope.Date.UTC().Format(time.RFC3339Nano)
		}
		subject := ""
		if msg.Envelope.Subject != "" {
			subject = msg.Envelope.Subject
		}
		messageID := ""
		if msg.Envelope.MessageId != "" {
			messageID = msg.Envelope.MessageId
		}
		out[msg.Uid] = EnvelopeInfo{
			Subject:         subject,
			Date:            date,
			MessageIDHeader: messageID,
		}
	}
	if err := <-done; err != nil {
		return nil, err
	}
	return out, nil
}

func FilterUIDsBySubject(provider, imapHost string, uids []uint32, envelopes map[uint32]EnvelopeInfo) []uint32 {
	if IsGmailProvider(provider, imapHost) {
		return uids
	}
	filtered := make([]uint32, 0, len(uids))
	for _, uid := range uids {
		env, ok := envelopes[uid]
		if !ok {
			continue
		}
		if MatchesEmailSubject(env.Subject) {
			filtered = append(filtered, uid)
		}
	}
	return filtered
}

func FetchMessageSource(c *client.Client, uid uint32) (*MessageSource, error) {
	seqSet := new(imap.SeqSet)
	seqSet.AddNum(uid)
	section := &imap.BodySectionName{}
	items := []imap.FetchItem{imap.FetchUid, imap.FetchEnvelope, section.FetchItem()}
	messages := make(chan *imap.Message, 1)

	done := make(chan error, 1)
	go func() {
		done <- c.UidFetch(seqSet, items, messages)
	}()

	var source []byte
	envelopeSubject := ""
	envelopeDate := time.Now().UTC().Format(time.RFC3339Nano)
	messageIDHeader := ""

	for msg := range messages {
		if msg.Body != nil {
			section := &imap.BodySectionName{}
			r := msg.GetBody(section)
			if r != nil {
				buf, err := io.ReadAll(r)
				if err != nil {
					return nil, err
				}
				source = buf
			}
		}
		if msg.Envelope != nil {
			envelopeSubject = msg.Envelope.Subject
			if !msg.Envelope.Date.IsZero() {
				envelopeDate = msg.Envelope.Date.UTC().Format(time.RFC3339Nano)
			}
			messageIDHeader = msg.Envelope.MessageId
		}
	}
	if err := <-done; err != nil {
		return nil, err
	}
	if len(source) == 0 {
		return nil, fmt.Errorf("no se pudo descargar el mensaje UID %d", uid)
	}

	return &MessageSource{
		Source:          source,
		EnvelopeSubject: envelopeSubject,
		EnvelopeDate:    envelopeDate,
		MessageIDHeader: messageIDHeader,
	}, nil
}

func FetchMessageSourcesConcurrent(
	c *client.Client,
	uids []uint32,
	concurrency int,
) (map[uint32]*MessageSource, error) {
	_ = concurrency
	return FetchMessageSourcesBatch(c, uids)
}

func FetchMessageSourcesBatch(c *client.Client, uids []uint32) (map[uint32]*MessageSource, error) {
	if len(uids) == 0 {
		return map[uint32]*MessageSource{}, nil
	}

	seqSet := new(imap.SeqSet)
	seqSet.AddNum(uids...)
	bodySection := &imap.BodySectionName{}
	items := []imap.FetchItem{imap.FetchUid, imap.FetchEnvelope, bodySection.FetchItem()}
	messages := make(chan *imap.Message, len(uids))

	done := make(chan error, 1)
	go func() {
		done <- c.UidFetch(seqSet, items, messages)
	}()

	out := make(map[uint32]*MessageSource, len(uids))
	for msg := range messages {
		if msg.Uid == 0 {
			continue
		}
		source, err := readMessageSource(msg)
		if err != nil {
			return out, err
		}
		out[msg.Uid] = source
	}
	if err := <-done; err != nil {
		return out, err
	}
	return out, nil
}

func readMessageSource(msg *imap.Message) (*MessageSource, error) {
	var source []byte
	envelopeSubject := ""
	envelopeDate := time.Now().UTC().Format(time.RFC3339Nano)
	messageIDHeader := ""

	if msg.Body != nil {
		section := &imap.BodySectionName{}
		r := msg.GetBody(section)
		if r != nil {
			buf, err := io.ReadAll(r)
			if err != nil {
				return nil, err
			}
			source = buf
		}
	}
	if msg.Envelope != nil {
		envelopeSubject = msg.Envelope.Subject
		if !msg.Envelope.Date.IsZero() {
			envelopeDate = msg.Envelope.Date.UTC().Format(time.RFC3339Nano)
		}
		messageIDHeader = msg.Envelope.MessageId
	}
	if len(source) == 0 {
		return nil, fmt.Errorf("no se pudo descargar el mensaje UID %d", msg.Uid)
	}

	return &MessageSource{
		Source:          source,
		EnvelopeSubject: envelopeSubject,
		EnvelopeDate:    envelopeDate,
		MessageIDHeader: messageIDHeader,
	}, nil
}

func EnvelopePrefetchBatch(provider, imapHost string, c *client.Client, uids []uint32) ([]uint32, map[uint32]EnvelopeInfo, error) {
	envelopes, err := FetchEnvelopes(c, uids)
	if err != nil {
		return nil, nil, err
	}
	filtered := FilterUIDsBySubject(provider, imapHost, uids, envelopes)
	return filtered, envelopes, nil
}

func ReadAllSource(msg *MessageSource) []byte {
	if msg == nil {
		return nil
	}
	return bytes.Clone(msg.Source)
}
