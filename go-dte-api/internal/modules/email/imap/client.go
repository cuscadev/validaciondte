package imaputil

import (
	"crypto/tls"
	"fmt"
	"time"

	"github.com/emersion/go-imap/client"
)

type Session struct {
	client *client.Client
	folder string
}

func dialClient(host string, port int, secure bool) (*client.Client, error) {
	addr := fmt.Sprintf("%s:%d", host, port)
	if secure {
		return client.DialTLS(addr, &tls.Config{ServerName: host})
	}
	return client.Dial(addr)
}

func selectFolder(c *client.Client, folder string) error {
	if folder == "" {
		folder = "INBOX"
	}
	_, err := c.Select(folder, false)
	return err
}

func Connect(host string, port int, secure bool, email, password, folder string) (*Session, error) {
	c, err := dialClient(host, port, secure)
	if err != nil {
		return nil, err
	}

	if err := c.Login(email, password); err != nil {
		_ = c.Logout()
		return nil, err
	}

	if err := selectFolder(c, folder); err != nil {
		_ = c.Logout()
		return nil, err
	}

	if folder == "" {
		folder = "INBOX"
	}
	return &Session{client: c, folder: folder}, nil
}

func ConnectWithOAuth(host string, port int, secure bool, email, accessToken, folder string) (*Session, error) {
	c, err := dialClient(host, port, secure)
	if err != nil {
		return nil, err
	}

	saslClient := newXoauth2Client(email, accessToken)
	if err := c.Authenticate(saslClient); err != nil {
		_ = c.Logout()
		return nil, err
	}

	if err := selectFolder(c, folder); err != nil {
		_ = c.Logout()
		return nil, err
	}

	if folder == "" {
		folder = "INBOX"
	}
	return &Session{client: c, folder: folder}, nil
}

func (s *Session) Client() *client.Client {
	return s.client
}

func (s *Session) Folder() string {
	return s.folder
}

func (s *Session) Logout() {
	if s.client != nil {
		_ = s.client.Logout()
	}
}

func (s *Session) SearchAndPrepareBatch(
	provider, imapHost, dateFrom, dateTo string,
	cursor *SyncCursorState,
	batchSize int,
) (*BatchPlan, error) {
	state := cursor
	if state == nil {
		uids, err := SearchUIDs(provider, imapHost, dateFrom, dateTo, s.client)
		if err != nil {
			return nil, err
		}
		state = &SyncCursorState{UIDs: uids, Index: 0}
	}

	end := state.Index + batchSize
	if end > len(state.UIDs) {
		end = len(state.UIDs)
	}
	batchUIDs := state.UIDs[state.Index:end]

	var filtered []uint32
	var envelopes map[uint32]EnvelopeInfo
	var err error

	if IsGmailProvider(provider, imapHost) {
		// X-GM-RAW already filters on Gmail; skip envelope prefetch.
		filtered = batchUIDs
		envelopes = map[uint32]EnvelopeInfo{}
	} else {
		filtered, envelopes, err = EnvelopePrefetchBatch(provider, imapHost, s.client, batchUIDs)
		if err != nil {
			return nil, err
		}
	}

	nextIndex := end
	completed := nextIndex >= len(state.UIDs)

	var next *SyncCursorState
	if !completed {
		next = &SyncCursorState{UIDs: state.UIDs, Index: nextIndex}
	}

	return &BatchPlan{
		UIDsToFetch: filtered,
		Envelopes:   envelopes,
		NextCursor:  next,
		Completed:   completed && len(batchUIDs) == 0 || completed,
	}, nil
}

type SyncCursorState struct {
	UIDs  []uint32
	Index int
}

type BatchPlan struct {
	UIDsToFetch []uint32
	Envelopes   map[uint32]EnvelopeInfo
	NextCursor  *SyncCursorState
	Completed   bool
}

func (s *Session) IdleTimeout() time.Duration {
	return 30 * time.Minute
}
