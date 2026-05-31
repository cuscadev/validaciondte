package shared

import "context"

func ProcessLinks(parent context.Context, links []string, concurrency int) []Result {
	return ProcessBatch(parent, links, concurrency)
}
