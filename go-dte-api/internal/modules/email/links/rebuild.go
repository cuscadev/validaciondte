package links

import (
	"context"
	"strings"

	"verificador-dte/go-dte-api/internal/modules/email/store"
)

var invoiceTipos = map[string]struct{}{
	"01": {}, "03": {}, "11": {}, "14": {},
}

const (
	ncTipo = "05"
	ndTipo = "06"
)

type pair struct {
	SourceDocumentID string
	TargetDocumentID string
	LinkType         string
}

func linkTypeForSource(tipoDte *string) string {
	if tipoDte == nil {
		return "json_reference"
	}
	switch *tipoDte {
	case ncTipo:
		return "nc_to_invoice"
	case ndTipo:
		return "nd_to_invoice"
	default:
		return "json_reference"
	}
}

func ComputeDocumentLinkPairs(documents []store.LinkPairInput) []pair {
	byCodigo := map[string][]store.LinkPairInput{}
	for _, doc := range documents {
		if doc.CodigoGeneracion == nil {
			continue
		}
		codigo := strings.ToUpper(*doc.CodigoGeneracion)
		byCodigo[codigo] = append(byCodigo[codigo], doc)
	}

	seen := map[string]struct{}{}
	var pairs []pair

	pushPair := func(p pair) {
		key := p.SourceDocumentID + ":" + p.TargetDocumentID + ":" + p.LinkType
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		pairs = append(pairs, p)
	}

	for _, doc := range documents {
		for _, codigoRaw := range doc.RelatedCodigos {
			targets := byCodigo[strings.ToUpper(codigoRaw)]
			for _, target := range targets {
				if target.ID == doc.ID {
					continue
				}
				pushPair(pair{
					SourceDocumentID: doc.ID,
					TargetDocumentID: target.ID,
					LinkType:         linkTypeForSource(doc.TipoDte),
				})
			}
		}

		if doc.TipoDte != nil && (*doc.TipoDte == ncTipo || *doc.TipoDte == ndTipo) {
			for _, codigoRaw := range doc.RelatedCodigos {
				targets := byCodigo[strings.ToUpper(codigoRaw)]
				for _, target := range targets {
					if target.ID == doc.ID {
						continue
					}
					if target.TipoDte == nil {
						continue
					}
					if _, ok := invoiceTipos[*target.TipoDte]; !ok {
						continue
					}
					pushPair(pair{
						SourceDocumentID: doc.ID,
						TargetDocumentID: target.ID,
						LinkType:         linkTypeForSource(doc.TipoDte),
					})
				}
			}
		}
	}

	for _, doc := range documents {
		if doc.TipoDte == nil {
			continue
		}
		if _, ok := invoiceTipos[*doc.TipoDte]; !ok {
			continue
		}
		if doc.CodigoGeneracion == nil {
			continue
		}
		codigo := strings.ToUpper(*doc.CodigoGeneracion)
		for _, other := range documents {
			if other.ID == doc.ID || other.TipoDte == nil {
				continue
			}
			if *other.TipoDte != ncTipo && *other.TipoDte != ndTipo {
				continue
			}
			for _, related := range other.RelatedCodigos {
				if strings.EqualFold(related, codigo) {
					pushPair(pair{
						SourceDocumentID: other.ID,
						TargetDocumentID: doc.ID,
						LinkType:         linkTypeForSource(other.TipoDte),
					})
				}
			}
		}
	}

	return pairs
}

func RebuildDocumentLinks(ctx context.Context, s *store.PostgresStore, organizationID string) error {
	documents, err := s.ListImportedDocumentsForOrg(ctx, organizationID)
	if err != nil {
		return err
	}
	pairs := ComputeDocumentLinkPairs(documents)
	for _, p := range pairs {
		if err := s.UpsertDocumentLink(ctx, store.DocumentLinkInput{
			OrganizationID:   organizationID,
			SourceDocumentID: p.SourceDocumentID,
			TargetDocumentID: p.TargetDocumentID,
			LinkType:         p.LinkType,
		}); err != nil {
			return err
		}
	}
	return nil
}
