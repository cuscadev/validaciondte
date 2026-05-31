package shared

import (
	"context"
	"strings"
)

func IsNotaCreditoTipo(tipo string) bool {
	t := normalizeLabel(tipo)
	return strings.Contains(t, "nota") && strings.Contains(t, "credito")
}

func PickNotaCredito(relacionados []RelatedDocument) *RelatedDocument {
	for i := range relacionados {
		rel := &relacionados[i]
		if IsNotaCreditoTipo(rel.TipoDocumentacion) && rel.CodigoGeneracion != "" {
			return rel
		}
	}
	for i := range relacionados {
		rel := &relacionados[i]
		if rel.CodigoGeneracion != "" {
			return rel
		}
	}
	return nil
}

func applyNotaCreditoFields(parent *Result, nc *RelatedDocument, verified Result, verifyErr error) {
	if parent == nil || nc == nil {
		return
	}

	parent.TieneNotaCredito = true
	parent.NotaCreditoCodigoGeneracion = nc.CodigoGeneracion
	parent.NotaCreditoSelloRecepcion = nc.SelloRecepcion
	parent.NotaCreditoFechaGeneracion = nc.FechaGeneracion
	parent.NotaCreditoFechaEmi = FechaEmiFromGeneracion(nc.FechaGeneracion)
	parent.NotaCreditoTipoDocumento = nc.TipoDocumentacion

	if verifyErr != nil {
		parent.NotaCreditoError = verifyErr.Error()
		nc.Error = verifyErr.Error()
		return
	}

	parent.NotaCreditoEstado = verified.Estado
	parent.NotaCreditoEstadoRaw = verified.EstadoRaw
	parent.NotaCreditoNumeroControl = verified.NumeroControl
	parent.NotaCreditoMontoTotal = verified.MontoTotal
	parent.NotaCreditoLinkVisita = verified.LinkVisita
	if parent.NotaCreditoLinkVisita == "" {
		parent.NotaCreditoLinkVisita = verified.URL
	}

	nc.Estado = verified.Estado
	nc.EstadoRaw = verified.EstadoRaw
	nc.Verificado = true
}

func EnrichCreditNotesFromRelated(parent context.Context, results []Result, concurrency int) []Result {
	needs := false
	for i := range results {
		nc := PickNotaCredito(results[i].Relacionados)
		if nc != nil && !results[i].TieneNotaCredito {
			needs = true
			break
		}
	}
	if !needs {
		return results
	}

	links := make([]string, 0, len(results))
	indexes := make([]int, 0, len(results))
	for i := range results {
		if results[i].TieneNotaCredito {
			continue
		}
		nc := PickNotaCredito(results[i].Relacionados)
		if nc == nil {
			continue
		}
		ambiente := results[i].Ambiente
		if ambiente == "" {
			ambiente = "01"
		}
		fechaEmi := FechaEmiFromGeneracion(nc.FechaGeneracion)
		if fechaEmi == "" {
			applyNotaCreditoFields(&results[i], nc, Result{}, errMissingNCDate)
			syncRelatedNC(&results[i], *nc, Result{}, errMissingNCDate)
			continue
		}
		links = append(links, BuildConsultaURL(nc.CodigoGeneracion, fechaEmi, ambiente))
		indexes = append(indexes, i)
	}

	if len(links) == 0 {
		return results
	}

	verified := ProcessBatch(parent, links, concurrency)
	for j, idx := range indexes {
		nc := PickNotaCredito(results[idx].Relacionados)
		if nc == nil {
			continue
		}
		applyNotaCreditoFields(&results[idx], nc, verified[j], nil)
		syncRelatedNC(&results[idx], *nc, verified[j], nil)
	}

	return results
}

var errMissingNCDate = &ncDateError{}

type ncDateError struct{}

func (e *ncDateError) Error() string {
	return "no se pudo obtener fecha de emision de la nota de credito relacionada"
}

func syncRelatedNC(parent *Result, nc RelatedDocument, verified Result, verifyErr error) {
	for i := range parent.Relacionados {
		if parent.Relacionados[i].CodigoGeneracion != nc.CodigoGeneracion {
			continue
		}
		if verifyErr != nil {
			parent.Relacionados[i].Error = verifyErr.Error()
			continue
		}
		parent.Relacionados[i].Estado = verified.Estado
		parent.Relacionados[i].EstadoRaw = verified.EstadoRaw
		parent.Relacionados[i].Verificado = true
	}
}
