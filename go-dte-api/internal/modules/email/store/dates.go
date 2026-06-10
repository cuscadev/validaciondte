package store

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func scanDateString(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format("2006-01-02")
}

func scanDatePtr(d pgtype.Date) *string {
	if !d.Valid {
		return nil
	}
	s := d.Time.Format("2006-01-02")
	return &s
}

func scanTimestamptzString(t pgtype.Timestamptz) string {
	if !t.Valid {
		return ""
	}
	return t.Time.UTC().Format(time.RFC3339Nano)
}

func scanTimestamptzTime(t pgtype.Timestamptz) time.Time {
	if !t.Valid {
		return time.Time{}
	}
	return t.Time
}

func parseTimestamptzForInsert(value string) pgtype.Timestamptz {
	var t pgtype.Timestamptz
	if value == "" {
		return t
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, value)
	}
	if err != nil {
		return t
	}
	t.Time = parsed.UTC()
	t.Valid = true
	return t
}

func parseDateForInsert(value *string) pgtype.Date {
	var d pgtype.Date
	if value == nil || *value == "" {
		return d
	}
	parsed, err := time.Parse("2006-01-02", *value)
	if err != nil {
		return d
	}
	d.Time = parsed
	d.Valid = true
	return d
}

func scanJSONContent(raw []byte) *string {
	if len(raw) == 0 {
		return nil
	}
	s := string(raw)
	return &s
}
