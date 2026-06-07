package catalogs

import (
	"errors"
	"strings"
)

type Service struct {
	documents map[string]DocumentSpec
}

type DocumentSpec struct {
	TipoDTE             string `json:"tipoDte"`
	Version             int    `json:"version"`
	Nombre              string `json:"nombre"`
	ReceptorKind        string `json:"receptorKind"`
	ItemsKind           string `json:"itemsKind"`
	RequiresRelatedDocs bool   `json:"requiresRelatedDocs"`
	RequiresContributor bool   `json:"requiresContributor"`
	SchemaVersion       string `json:"schemaVersion"`
}

const (
	TipoDTEFactura        = "01"
	TipoDTECreditoFiscal  = "03"
	TipoDTENotaCredito    = "05"
	TipoDTENotaDebito     = "06"
	TipoDTESujetoExcluido = "14"

	ReceptorConsumidorFinal = "consumer"
	ReceptorContribuyente   = "taxpayer"
	ReceptorNota            = "note"
	ReceptorSujetoExcluido  = "excluded_subject"

	ItemsFactura        = "invoice"
	ItemsCreditoFiscal  = "tax_credit"
	ItemsNota           = "adjustment_note"
	ItemsSujetoExcluido = "excluded_subject"
)

func NewService() *Service {
	docs := map[string]DocumentSpec{
		TipoDTEFactura: {
			TipoDTE:       TipoDTEFactura,
			Version:       2,
			Nombre:        "Factura consumidor final",
			ReceptorKind:  ReceptorConsumidorFinal,
			ItemsKind:     ItemsFactura,
			SchemaVersion: "v2",
		},
		TipoDTECreditoFiscal: {
			TipoDTE:             TipoDTECreditoFiscal,
			Version:             4,
			Nombre:              "Comprobante de credito fiscal",
			ReceptorKind:        ReceptorContribuyente,
			ItemsKind:           ItemsCreditoFiscal,
			RequiresContributor: true,
			SchemaVersion:       "v4",
		},
		TipoDTENotaCredito: {
			TipoDTE:             TipoDTENotaCredito,
			Version:             4,
			Nombre:              "Nota de credito",
			ReceptorKind:        ReceptorNota,
			ItemsKind:           ItemsNota,
			RequiresRelatedDocs: true,
			SchemaVersion:       "v4",
		},
		TipoDTENotaDebito: {
			TipoDTE:             TipoDTENotaDebito,
			Version:             4,
			Nombre:              "Nota de debito",
			ReceptorKind:        ReceptorNota,
			ItemsKind:           ItemsNota,
			RequiresRelatedDocs: true,
			SchemaVersion:       "v4",
		},
		TipoDTESujetoExcluido: {
			TipoDTE:       TipoDTESujetoExcluido,
			Version:       2,
			Nombre:        "Factura de sujeto excluido",
			ReceptorKind:  ReceptorSujetoExcluido,
			ItemsKind:     ItemsSujetoExcluido,
			SchemaVersion: "v2",
		},
	}

	return &Service{documents: docs}
}

func (s *Service) GetDocumentSpec(tipoDTE string) (DocumentSpec, error) {
	key := strings.TrimSpace(tipoDTE)
	if key == "" {
		return DocumentSpec{}, errors.New("tipoDte es requerido")
	}
	spec, ok := s.documents[key]
	if !ok {
		return DocumentSpec{}, errors.New("tipoDte no soportado")
	}
	return spec, nil
}

func (s *Service) ListDocumentSpecs() []DocumentSpec {
	out := make([]DocumentSpec, 0, len(s.documents))
	for _, spec := range s.documents {
		out = append(out, spec)
	}
	return out
}
