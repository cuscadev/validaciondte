package imaputil

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	"github.com/emersion/go-imap/commands"
	"github.com/emersion/go-imap/responses"
)

type gmailRawSearch struct {
	query string
}

func (g *gmailRawSearch) Command() *imap.Command {
	return &imap.Command{
		Name: "SEARCH",
		Arguments: []interface{}{
			imap.RawString("X-GM-RAW"),
			g.query,
		},
	}
}

// IsGmailProvider returns true when the connection should use Gmail X-GM-RAW search.
func IsGmailProvider(provider, imapHost string) bool {
	if strings.EqualFold(strings.TrimSpace(provider), "gmail") {
		return true
	}
	host := strings.ToLower(strings.TrimSpace(imapHost))
	return host == "imap.gmail.com" || strings.HasSuffix(host, ".gmail.com")
}

func AddDays(dateKey string, days int) (string, error) {
	t, err := time.Parse("2006-01-02", dateKey)
	if err != nil {
		return "", err
	}
	return t.AddDate(0, 0, days).Format("2006-01-02"), nil
}

func BuildGmailRawQuery(dateFrom, dateTo string) (string, error) {
	after := strings.ReplaceAll(dateFrom, "-", "/")
	beforeDay, err := AddDays(dateTo, 1)
	if err != nil {
		return "", err
	}
	before := strings.ReplaceAll(beforeDay, "-", "/")
	keywords := `(factura OR credito OR fiscal OR nota OR debito OR DTE OR CCF)`
	return fmt.Sprintf("after:%s before:%s has:attachment filename:json %s", after, before, keywords), nil
}

func BuildDateSearchCriteria(dateFrom, dateTo string) (*imap.SearchCriteria, error) {
	beforeDay, err := AddDays(dateTo, 1)
	if err != nil {
		return nil, err
	}
	since, err := time.Parse("2006-01-02", dateFrom)
	if err != nil {
		return nil, err
	}
	before, err := time.Parse("2006-01-02", beforeDay)
	if err != nil {
		return nil, err
	}
	return &imap.SearchCriteria{
		Since:  since,
		Before: before,
	}, nil
}

func SearchUIDsGmailRaw(c *client.Client, rawQuery string) ([]uint32, error) {
	cmd := &commands.Uid{Cmd: &gmailRawSearch{query: rawQuery}}
	res := new(responses.Search)
	status, err := c.Execute(cmd, res)
	if err != nil {
		return nil, err
	}
	if err := status.Err(); err != nil {
		return nil, err
	}
	return res.Ids, nil
}

func SearchUIDsGeneric(c *client.Client, dateFrom, dateTo string) ([]uint32, error) {
	criteria, err := BuildDateSearchCriteria(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}
	return c.UidSearch(criteria)
}

func SearchUIDs(provider, imapHost, dateFrom, dateTo string, c *client.Client) ([]uint32, error) {
	if IsGmailProvider(provider, imapHost) {
		query, err := BuildGmailRawQuery(dateFrom, dateTo)
		if err != nil {
			return nil, err
		}
		uids, err := SearchUIDsGmailRaw(c, query)
		if err != nil {
			return nil, fmt.Errorf("gmail X-GM-RAW search failed: %w", err)
		}
		log.Printf("[email-sync] gmail X-GM-RAW query=%q uids=%d", query, len(uids))
		return sortUIDs(uids), nil
	}

	criteria, err := BuildDateSearchCriteria(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}
	uids, err := c.UidSearch(criteria)
	if err != nil {
		return nil, err
	}
	log.Printf("[email-sync] generic IMAP SINCE/BEFORE provider=%s uids=%d", provider, len(uids))
	return sortUIDs(uids), nil
}

func sortUIDs(uids []uint32) []uint32 {
	if len(uids) < 2 {
		return uids
	}
	sorted := append([]uint32(nil), uids...)
	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j] < sorted[i] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	return sorted
}
