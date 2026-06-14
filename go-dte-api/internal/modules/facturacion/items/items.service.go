package items

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"verificador-dte/go-dte-api/internal/modules/facturacion/catalogs"
	"verificador-dte/go-dte-api/internal/modules/facturacion/documents/domain"
	"verificador-dte/go-dte-api/internal/modules/facturacion/items/dto"
)

const (
	ivaConsumidorFinal = 13.0 / 113.0
)

type Service struct {
	catalogs *catalogs.Service
}

func NewService(catalogService *catalogs.Service) *Service {
	return &Service{catalogs: catalogService}
}

func (s *Service) Build(req dto.BuildItemsRequest) (dto.BuildItemsResponse, error) {
	spec, err := s.catalogs.GetDocumentSpec(req.TipoDTE)
	if err != nil {
		return dto.BuildItemsResponse{}, err
	}

	cuerpo, total, err := s.buildByKind(spec.ItemsKind, req)
	if err != nil {
		return dto.BuildItemsResponse{}, err
	}

	return dto.BuildItemsResponse{
		Success:         true,
		TipoDTE:         spec.TipoDTE,
		ItemsKind:       spec.ItemsKind,
		CuerpoDocumento: cuerpo,
		Total:           total,
	}, nil
}

func (s *Service) buildByKind(kind string, input dto.BuildItemsRequest) (any, float64, error) {
	switch kind {
	case catalogs.ItemsFactura:
		if err := validateItems(input.Items); err != nil {
			return nil, 0, err
		}
		cuerpo, total := buildFacturaItems(input.Items)
		return cuerpo, total, nil
	case catalogs.ItemsCreditoFiscal:
		if err := validateItems(input.Items); err != nil {
			return nil, 0, err
		}
		cuerpo, total := buildCreditoFiscalItems(input.Items, input.IVAPerci, input.IVARete)
		return cuerpo, total, nil
	case catalogs.ItemsNota:
		if err := validateItems(input.Items); err != nil {
			return nil, 0, err
		}
		if len(input.DocumentoRelacionado) == 0 || strings.TrimSpace(input.DocumentoRelacionado[0].NumeroDocumento) == "" {
			return nil, 0, errors.New("documentoRelacionado[0].numeroDocumento es requerido para items de notas")
		}
		cuerpo, total := buildNotaItems(input.Items, input.DocumentoRelacionado[0].NumeroDocumento, input.IVAPerci, input.IVARete)
		return cuerpo, total, nil
	case catalogs.ItemsSujetoExcluido:
		if err := validateExcludedSubjectItems(input.SujetoExcluidoItems); err != nil {
			return nil, 0, err
		}
		cuerpo, total := buildSujetoExcluidoItems(input.SujetoExcluidoItems)
		return cuerpo, total, nil
	case catalogs.ItemsExportacion:
		if err := validateItems(input.Items); err != nil {
			return nil, 0, err
		}
		cuerpo, total := buildExportItems(input.Items)
		return cuerpo, total, nil
	default:
		return nil, 0, fmt.Errorf("tipo de items no soportado: %s", kind)
	}
}

func buildFacturaItems(items []dto.ItemInput) ([]domain.CuerpoDocumento, float64) {
	cuerpo := make([]domain.CuerpoDocumento, 0, len(items))
	var total float64
	for i, item := range items {
		ventaNoSuj, ventaExenta, ventaGravada := itemAmounts(item)
		ivaItem := round2(ventaGravada * ivaConsumidorFinal)
		total += ventaNoSuj + ventaExenta + ventaGravada + item.NoGravado
		cuerpo = append(cuerpo, domain.CuerpoDocumento{
			NumItem:         i + 1,
			TipoItem:        defaultInt(item.TipoItem, 2),
			NumeroDocumento: item.NumeroDocumento,
			Codigo:          item.Codigo,
			CodTributo:      item.CodTributo,
			Descripcion:     item.Descripcion,
			Cantidad:        round8(item.Cantidad),
			UniMedida:       defaultInt(item.UniMedida, 59),
			PrecioUni:       round8(item.PrecioUni),
			MontoDescu:      round2(item.MontoDescu),
			VentaNoSuj:      ventaNoSuj,
			VentaExenta:     ventaExenta,
			VentaGravada:    ventaGravada,
			Tributos:        nil,
			PSV:             round2(item.PSV),
			NoGravado:       round2(item.NoGravado),
			IVAItem:         ivaItem,
		})
	}
	return cuerpo, round2(total)
}

func buildCreditoFiscalItems(items []dto.ItemInput, ivaPerci float64, ivaRete float64) ([]domain.CuerpoDocumentoCreditoFiscal, float64) {
	cuerpo := make([]domain.CuerpoDocumentoCreditoFiscal, 0, len(items))
	var total float64
	for i, item := range items {
		ventaNoSuj, ventaExenta, ventaGravada := itemAmounts(item)
		total += ventaNoSuj + ventaExenta + ventaGravada + item.NoGravado
		cuerpo = append(cuerpo, domain.CuerpoDocumentoCreditoFiscal{
			NumItem:         i + 1,
			TipoItem:        defaultInt(item.TipoItem, 2),
			NumeroDocumento: item.NumeroDocumento,
			Codigo:          item.Codigo,
			CodTributo:      item.CodTributo,
			Descripcion:     item.Descripcion,
			Cantidad:        round8(item.Cantidad),
			UniMedida:       defaultInt(item.UniMedida, 59),
			PrecioUni:       round8(item.PrecioUni),
			MontoDescu:      round2(item.MontoDescu),
			VentaNoSuj:      ventaNoSuj,
			VentaExenta:     ventaExenta,
			VentaGravada:    ventaGravada,
			Tributos:        nil,
			PSV:             round2(item.PSV),
			NoGravado:       round2(item.NoGravado),
		})
	}
	return cuerpo, round2(total + ivaPerci - ivaRete)
}

func buildNotaItems(items []dto.ItemInput, defaultRelatedDocument string, ivaPerci float64, ivaRete float64) ([]domain.CuerpoDocumentoNota, float64) {
	cuerpo := make([]domain.CuerpoDocumentoNota, 0, len(items))
	var total float64
	for i, item := range items {
		ventaNoSuj, ventaExenta, ventaGravada := itemAmounts(item)
		totalIVA := round2(ventaGravada * 0.13)
		numeroDocumento := strings.TrimSpace(defaultRelatedDocument)
		if item.NumeroDocumento != nil && strings.TrimSpace(*item.NumeroDocumento) != "" {
			numeroDocumento = strings.TrimSpace(*item.NumeroDocumento)
		}
		itemIVAPerci, itemIVARete := 0.0, 0.0
		if len(items) == 1 {
			itemIVAPerci = round2(ivaPerci)
			itemIVARete = round2(ivaRete)
		}
		total += ventaNoSuj + ventaExenta + ventaGravada + totalIVA + item.NoGravado
		cuerpo = append(cuerpo, domain.CuerpoDocumentoNota{
			NumItem:         i + 1,
			TipoItem:        defaultInt(item.TipoItem, 2),
			NumeroDocumento: numeroDocumento,
			Cantidad:        round8(item.Cantidad),
			Codigo:          item.Codigo,
			CodTributo:      item.CodTributo,
			UniMedida:       defaultInt(item.UniMedida, 59),
			Descripcion:     item.Descripcion,
			PrecioUni:       round8(item.PrecioUni),
			MontoDescu:      round2(item.MontoDescu),
			VentaNoSuj:      ventaNoSuj,
			VentaExenta:     ventaExenta,
			VentaGravada:    ventaGravada,
			Tributos:        nil,
			NoGravado:       round2(item.NoGravado),
			IVAPerci:        itemIVAPerci,
			TotalIVA:        totalIVA,
			IVARete:         itemIVARete,
		})
	}
	return cuerpo, round2(total + ivaPerci - ivaRete)
}

func buildExportItems(items []dto.ItemInput) ([]domain.CuerpoDocumentoExportacion, float64) {
	cuerpo := make([]domain.CuerpoDocumentoExportacion, 0, len(items))
	var total float64
	for i, item := range items {
		ventaGravada := round2(item.VentaGravada)
		if ventaGravada == 0 {
			ventaGravada = round2(item.Cantidad*item.PrecioUni - item.MontoDescu)
		}
		total += ventaGravada + round2(item.NoGravado)
		cuerpo = append(cuerpo, domain.CuerpoDocumentoExportacion{
			NumItem:      i + 1,
			Cantidad:     round8(item.Cantidad),
			Codigo:       item.Codigo,
			UniMedida:    defaultInt(item.UniMedida, 59),
			Descripcion:  item.Descripcion,
			PrecioUni:    round8(item.PrecioUni),
			MontoDescu:   round2(item.MontoDescu),
			VentaGravada: ventaGravada,
			NoGravado:    round2(item.NoGravado),
		})
	}
	return cuerpo, round2(total)
}

func buildSujetoExcluidoItems(items []dto.ExcludedSubjectItemInput) ([]domain.CuerpoDocumentoSujetoExcluido, float64) {
	cuerpo := make([]domain.CuerpoDocumentoSujetoExcluido, 0, len(items))
	var total float64
	for i, item := range items {
		compra := round2(item.Compra)
		if compra == 0 {
			compra = round2(item.Cantidad*item.PrecioUni - item.MontoDescu)
		}
		total += compra
		cuerpo = append(cuerpo, domain.CuerpoDocumentoSujetoExcluido{
			NumItem:     i + 1,
			TipoItem:    defaultInt(item.TipoItem, 2),
			Cantidad:    round8(item.Cantidad),
			Codigo:      item.Codigo,
			UniMedida:   defaultInt(item.UniMedida, 59),
			Descripcion: item.Descripcion,
			PrecioUni:   round8(item.PrecioUni),
			MontoDescu:  round2(item.MontoDescu),
			Compra:      compra,
		})
	}
	return cuerpo, round2(total)
}

func itemAmounts(item dto.ItemInput) (float64, float64, float64) {
	ventaNoSuj := round2(item.VentaNoSuj)
	ventaExenta := round2(item.VentaExenta)
	ventaGravada := round2(item.VentaGravada)
	if ventaNoSuj == 0 && ventaExenta == 0 && ventaGravada == 0 && item.NoGravado == 0 {
		ventaGravada = round2(item.Cantidad*item.PrecioUni - item.MontoDescu)
	}
	return ventaNoSuj, ventaExenta, ventaGravada
}

func validateItems(items []dto.ItemInput) error {
	if len(items) == 0 {
		return errors.New("items es requerido")
	}
	for i, item := range items {
		if strings.TrimSpace(item.Descripcion) == "" {
			return fmt.Errorf("items[%d].descripcion es requerido", i)
		}
		if item.Cantidad <= 0 {
			return fmt.Errorf("items[%d].cantidad debe ser mayor a cero", i)
		}
		if item.PrecioUni <= 0 && item.VentaNoSuj <= 0 && item.VentaExenta <= 0 && item.VentaGravada <= 0 && item.NoGravado <= 0 {
			return fmt.Errorf("items[%d].precioUni o venta debe ser mayor a cero", i)
		}
	}
	return nil
}

func validateExcludedSubjectItems(items []dto.ExcludedSubjectItemInput) error {
	if len(items) == 0 {
		return errors.New("items es requerido")
	}
	for i, item := range items {
		if strings.TrimSpace(item.Descripcion) == "" {
			return fmt.Errorf("items[%d].descripcion es requerido", i)
		}
		if item.Cantidad <= 0 {
			return fmt.Errorf("items[%d].cantidad debe ser mayor a cero", i)
		}
		if item.PrecioUni <= 0 && item.Compra <= 0 {
			return fmt.Errorf("items[%d].precioUni o compra debe ser mayor a cero", i)
		}
	}
	return nil
}

func defaultInt(value int, fallback int) int {
	if value == 0 {
		return fallback
	}
	return value
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

func round8(value float64) float64 {
	return math.Round(value*100000000) / 100000000
}
