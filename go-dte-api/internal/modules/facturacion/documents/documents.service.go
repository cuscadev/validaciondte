package documents

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"

	"verificador-dte/go-dte-api/internal/modules/facturacion/catalogs"
	"verificador-dte/go-dte-api/internal/modules/facturacion/documents/domain"
	"verificador-dte/go-dte-api/internal/modules/facturacion/documents/dto"
	"verificador-dte/go-dte-api/internal/modules/facturacion/location"
)

const (
	tipoDTEFactura        = "01"
	tipoDTECreditoFiscal  = "03"
	tipoDTENotaCredito    = "05"
	tipoDTENotaDebito     = "06"
	tipoDTEExportacion    = "11"
	tipoDTESujetoExcluido = "14"
	ambienteTest          = "00"
	monedaUSD             = "USD"
	modeloPrevio          = 1
	operacionNormal       = 1
	condicionContado      = 1
	formaPagoEfectivo     = "01"
	ivaConsumidorFinal    = 13.0 / 113.0
)

type Service struct {
	catalogs *catalogs.Service
}

func NewService(catalogService *catalogs.Service) *Service {
	return &Service{catalogs: catalogService}
}

func (s *Service) PreviewDocument(req dto.PreviewDocumentRequest) (dto.PreviewDocumentResponse, error) {
	spec, err := s.catalogs.GetDocumentSpec(req.TipoDTE)
	if err != nil {
		return dto.PreviewDocumentResponse{}, err
	}

	switch spec.TipoDTE {
	case tipoDTEFactura:
		if req.FacturaConsumidorFinal == nil {
			return dto.PreviewDocumentResponse{}, errors.New("facturaConsumidorFinal es requerido para tipoDte 01")
		}
		resp, err := s.CreateConsumerInvoice(*req.FacturaConsumidorFinal)
		if err != nil {
			return dto.PreviewDocumentResponse{}, err
		}
		return mapPreviewResponse(spec, resp.CodigoGeneracion, resp.NumeroControl, resp.TotalPagar, resp.DTEJSON), nil
	case tipoDTECreditoFiscal:
		if req.CreditoFiscal == nil {
			return dto.PreviewDocumentResponse{}, errors.New("creditoFiscal es requerido para tipoDte 03")
		}
		resp, err := s.CreateTaxCreditInvoice(*req.CreditoFiscal)
		if err != nil {
			return dto.PreviewDocumentResponse{}, err
		}
		return mapPreviewResponse(spec, resp.CodigoGeneracion, resp.NumeroControl, resp.TotalPagar, resp.DTEJSON), nil
	case tipoDTENotaCredito, tipoDTENotaDebito:
		if req.Nota == nil {
			return dto.PreviewDocumentResponse{}, errors.New("nota es requerido para tipoDte 05/06")
		}
		resp, err := s.createAdjustmentNote(*req.Nota, spec.TipoDTE)
		if err != nil {
			return dto.PreviewDocumentResponse{}, err
		}
		return mapPreviewResponse(spec, resp.CodigoGeneracion, resp.NumeroControl, resp.TotalPagar, resp.DTEJSON), nil
	case tipoDTEExportacion:
		if req.Exportacion == nil {
			return dto.PreviewDocumentResponse{}, errors.New("exportacion es requerido para tipoDte 11")
		}
		resp, err := s.CreateExportInvoice(*req.Exportacion)
		if err != nil {
			return dto.PreviewDocumentResponse{}, err
		}
		return mapPreviewResponse(spec, resp.CodigoGeneracion, resp.NumeroControl, resp.TotalPagar, resp.DTEJSON), nil
	case tipoDTESujetoExcluido:
		if req.SujetoExcluido == nil {
			return dto.PreviewDocumentResponse{}, errors.New("sujetoExcluido es requerido para tipoDte 14")
		}
		resp, err := s.CreateExcludedSubjectInvoice(*req.SujetoExcluido)
		if err != nil {
			return dto.PreviewDocumentResponse{}, err
		}
		return mapPreviewResponse(spec, resp.CodigoGeneracion, resp.NumeroControl, resp.TotalPagar, resp.DTEJSON), nil
	default:
		return dto.PreviewDocumentResponse{}, errors.New("tipoDte no soportado")
	}
}

func (s *Service) CreateConsumerInvoice(req dto.CreateConsumerInvoiceRequest) (dto.CreateConsumerInvoiceResponse, error) {
	if err := validateConsumerInvoiceRequest(req); err != nil {
		return dto.CreateConsumerInvoiceResponse{}, err
	}
	spec, err := s.catalogs.GetDocumentSpec(tipoDTEFactura)
	if err != nil {
		return dto.CreateConsumerInvoiceResponse{}, err
	}

	now := time.Now()
	fecEmi := firstNonEmpty(req.FecEmi, now.Format("2006-01-02"))
	horEmi := firstNonEmpty(req.HorEmi, now.Format("15:04:05"))
	ambiente := firstNonEmpty(req.Ambiente, ambienteTest)
	codigoGeneracion := strings.ToUpper(firstNonEmpty(req.CodigoGeneracion, uuid.NewString()))
	numeroControl := firstNonEmpty(req.NumeroControl, buildNumeroControl(req))

	cuerpo, resumen := buildFacturaItemsAndResumen(req.Items)
	resumen.Pagos = normalizePagos(req.Pagos, resumen.TotalPagar)
	resumen.Observaciones = req.Observaciones
	resumen.TotalLetras = totalEnLetras(resumen.TotalPagar)

	dte := domain.FacturaConsumidorFinal{
		Identificacion: domain.Identificacion{
			Version:          spec.Version,
			Ambiente:         ambiente,
			TipoDTE:          tipoDTEFactura,
			NumeroControl:    numeroControl,
			CodigoGeneracion: codigoGeneracion,
			TipoModelo:       defaultInt(req.TipoModelo, modeloPrevio),
			TipoOperacion:    defaultInt(req.TipoOperacion, operacionNormal),
			TipoContingencia: nil,
			MotivoContin:     nil,
			FecEmi:           fecEmi,
			HorEmi:           horEmi,
			TipoMoneda:       monedaUSD,
		},
		DocumentoRelacionado: nil,
		Emisor:               finalizeEmisor(req.Emisor, req.Establecimiento, req.PuntoVenta),
		Receptor:             mapReceptor(req.Receptor),
		OtrosDocumentos:      nil,
		VentaTercero:         nil,
		CuerpoDocumento:      cuerpo,
		Resumen:              resumen,
		Apendice:             mapApendice(req.Apendice),
	}

	raw, err := json.Marshal(dte)
	if err != nil {
		return dto.CreateConsumerInvoiceResponse{}, err
	}

	return dto.CreateConsumerInvoiceResponse{
		Success:          true,
		TipoDTE:          tipoDTEFactura,
		CodigoGeneracion: codigoGeneracion,
		NumeroControl:    numeroControl,
		TotalPagar:       resumen.TotalPagar,
		DTEJSON:          raw,
	}, nil
}

func mapPreviewResponse(spec catalogs.DocumentSpec, codigoGeneracion string, numeroControl string, totalPagar float64, dteJSON json.RawMessage) dto.PreviewDocumentResponse {
	return dto.PreviewDocumentResponse{
		Success:          true,
		TipoDTE:          spec.TipoDTE,
		Version:          spec.Version,
		Nombre:           spec.Nombre,
		CodigoGeneracion: codigoGeneracion,
		NumeroControl:    numeroControl,
		TotalPagar:       totalPagar,
		ReceptorKind:     spec.ReceptorKind,
		ItemsKind:        spec.ItemsKind,
		DTEJSON:          dteJSON,
	}
}

func (s *Service) CreateTaxCreditInvoice(req dto.CreateTaxCreditInvoiceRequest) (dto.CreateTaxCreditInvoiceResponse, error) {
	if err := validateTaxCreditInvoiceRequest(req); err != nil {
		return dto.CreateTaxCreditInvoiceResponse{}, err
	}
	spec, err := s.catalogs.GetDocumentSpec(tipoDTECreditoFiscal)
	if err != nil {
		return dto.CreateTaxCreditInvoiceResponse{}, err
	}

	now := time.Now()
	fecEmi := firstNonEmpty(req.FecEmi, now.Format("2006-01-02"))
	horEmi := firstNonEmpty(req.HorEmi, now.Format("15:04:05"))
	ambiente := firstNonEmpty(req.Ambiente, ambienteTest)
	codigoGeneracion := strings.ToUpper(firstNonEmpty(req.CodigoGeneracion, uuid.NewString()))
	numeroControl := firstNonEmpty(req.NumeroControl, buildNumeroControlByTipo(tipoDTECreditoFiscal, req.EstablecimientoTipo, req.Establecimiento, req.PuntoVenta, req.Correlativo))

	cuerpo, resumen := buildCreditoFiscalItemsAndResumen(req.Items, req.IVAPerci, req.IVARete)
	resumen.Pagos = normalizePagos(req.Pagos, resumen.TotalPagar)
	resumen.Observaciones = req.Observaciones
	resumen.TotalLetras = totalEnLetras(resumen.TotalPagar)

	dte := domain.ComprobanteCreditoFiscal{
		Identificacion: domain.Identificacion{
			Version:          spec.Version,
			Ambiente:         ambiente,
			TipoDTE:          tipoDTECreditoFiscal,
			NumeroControl:    numeroControl,
			CodigoGeneracion: codigoGeneracion,
			TipoModelo:       defaultInt(req.TipoModelo, modeloPrevio),
			TipoOperacion:    defaultInt(req.TipoOperacion, operacionNormal),
			TipoContingencia: nil,
			MotivoContin:     nil,
			FecEmi:           fecEmi,
			HorEmi:           horEmi,
			TipoMoneda:       monedaUSD,
		},
		DocumentoRelacionado: nil,
		Emisor:               finalizeEmisor(req.Emisor, req.Establecimiento, req.PuntoVenta),
		Receptor:             mapTaxCreditReceptor(req.Receptor),
		OtrosDocumentos:      nil,
		VentaTercero:         nil,
		CuerpoDocumento:      cuerpo,
		Resumen:              resumen,
		Apendice:             mapApendice(req.Apendice),
	}

	raw, err := json.Marshal(dte)
	if err != nil {
		return dto.CreateTaxCreditInvoiceResponse{}, err
	}

	return dto.CreateTaxCreditInvoiceResponse{
		Success:          true,
		TipoDTE:          tipoDTECreditoFiscal,
		CodigoGeneracion: codigoGeneracion,
		NumeroControl:    numeroControl,
		TotalPagar:       resumen.TotalPagar,
		DTEJSON:          raw,
	}, nil
}

func (s *Service) CreateCreditNote(req dto.CreateAdjustmentNoteRequest) (dto.CreateAdjustmentNoteResponse, error) {
	return s.createAdjustmentNote(req, tipoDTENotaCredito)
}

func (s *Service) CreateDebitNote(req dto.CreateAdjustmentNoteRequest) (dto.CreateAdjustmentNoteResponse, error) {
	return s.createAdjustmentNote(req, tipoDTENotaDebito)
}

func (s *Service) CreateExportInvoice(req dto.CreateExportInvoiceRequest) (dto.CreateExportInvoiceResponse, error) {
	if err := validateExportInvoiceRequest(req); err != nil {
		return dto.CreateExportInvoiceResponse{}, err
	}
	spec, err := s.catalogs.GetDocumentSpec(tipoDTEExportacion)
	if err != nil {
		return dto.CreateExportInvoiceResponse{}, err
	}

	now := time.Now()
	fecEmi := firstNonEmpty(req.FecEmi, now.Format("2006-01-02"))
	horEmi := firstNonEmpty(req.HorEmi, now.Format("15:04:05"))
	ambiente := firstNonEmpty(req.Ambiente, ambienteTest)
	codigoGeneracion := strings.ToUpper(firstNonEmpty(req.CodigoGeneracion, uuid.NewString()))
	numeroControl := firstNonEmpty(req.NumeroControl, buildNumeroControlByTipo(tipoDTEExportacion, req.EstablecimientoTipo, req.Establecimiento, req.PuntoVenta, req.Correlativo))

	cuerpo, resumen := buildExportItemsAndResumen(req.Items, req.Flete, req.Seguro)
	condicion := defaultInt(req.CondicionOperacion, condicionContado)
	resumen.CondicionOperacion = condicion
	resumen.Pagos = normalizePagos(req.Pagos, resumen.TotalPagar)
	resumen.CodIncoterms = req.CodIncoterms
	resumen.DescIncoterms = req.DescIncoterms
	resumen.Observaciones = req.Observaciones
	resumen.TotalLetras = totalEnLetras(resumen.TotalPagar)

	dte := domain.FacturaExportacion{
		Identificacion: domain.Identificacion{
			Version:          spec.Version,
			Ambiente:         ambiente,
			TipoDTE:          tipoDTEExportacion,
			NumeroControl:    numeroControl,
			CodigoGeneracion: codigoGeneracion,
			TipoModelo:       defaultInt(req.TipoModelo, modeloPrevio),
			TipoOperacion:    defaultInt(req.TipoOperacion, operacionNormal),
			TipoContingencia: nil,
			MotivoContin:     nil,
			FecEmi:           fecEmi,
			HorEmi:           horEmi,
			TipoMoneda:       monedaUSD,
		},
		Emisor:          finalizeEmisor(req.Emisor, req.Establecimiento, req.PuntoVenta),
		Receptor:        mapExportReceptor(req.Receptor),
		OtrosDocumentos: mapExportOtherDocuments(req.OtrosDocumentos),
		VentaTercero:    mapVentaTercero(req.VentaTercero),
		CuerpoDocumento: cuerpo,
		Resumen:         resumen,
		Apendice:        mapApendice(req.Apendice),
	}

	raw, err := json.Marshal(dte)
	if err != nil {
		return dto.CreateExportInvoiceResponse{}, err
	}

	return dto.CreateExportInvoiceResponse{
		Success:          true,
		TipoDTE:          tipoDTEExportacion,
		CodigoGeneracion: codigoGeneracion,
		NumeroControl:    numeroControl,
		TotalPagar:       resumen.TotalPagar,
		DTEJSON:          raw,
	}, nil
}

func (s *Service) CreateExcludedSubjectInvoice(req dto.CreateExcludedSubjectInvoiceRequest) (dto.CreateExcludedSubjectInvoiceResponse, error) {
	if err := validateExcludedSubjectInvoiceRequest(req); err != nil {
		return dto.CreateExcludedSubjectInvoiceResponse{}, err
	}
	spec, err := s.catalogs.GetDocumentSpec(tipoDTESujetoExcluido)
	if err != nil {
		return dto.CreateExcludedSubjectInvoiceResponse{}, err
	}

	now := time.Now()
	fecEmi := firstNonEmpty(req.FecEmi, now.Format("2006-01-02"))
	horEmi := firstNonEmpty(req.HorEmi, now.Format("15:04:05"))
	ambiente := firstNonEmpty(req.Ambiente, ambienteTest)
	codigoGeneracion := strings.ToUpper(firstNonEmpty(req.CodigoGeneracion, uuid.NewString()))
	numeroControl := firstNonEmpty(req.NumeroControl, buildNumeroControlByTipo(tipoDTESujetoExcluido, req.EstablecimientoTipo, req.Establecimiento, req.PuntoVenta, req.Correlativo))

	cuerpo, resumen := buildExcludedSubjectItemsAndResumen(req.Items, req.ReteRenta)
	resumen.Pagos = normalizePagos(req.Pagos, resumen.TotalPagar)
	resumen.Observaciones = req.Observaciones
	resumen.TotalLetras = totalEnLetras(resumen.TotalPagar)

	dte := domain.FacturaSujetoExcluido{
		Identificacion: domain.Identificacion{
			Version:          spec.Version,
			Ambiente:         ambiente,
			TipoDTE:          tipoDTESujetoExcluido,
			NumeroControl:    numeroControl,
			CodigoGeneracion: codigoGeneracion,
			TipoModelo:       defaultInt(req.TipoModelo, modeloPrevio),
			TipoOperacion:    defaultInt(req.TipoOperacion, operacionNormal),
			TipoContingencia: nil,
			MotivoContin:     nil,
			FecEmi:           fecEmi,
			HorEmi:           horEmi,
			TipoMoneda:       monedaUSD,
		},
		Emisor:          mapExcludedSubjectIssuer(req.Emisor),
		Receptor:        mapExcludedSubjectReceptor(req.Receptor),
		CuerpoDocumento: cuerpo,
		Resumen:         resumen,
		Apendice:        mapApendice(req.Apendice),
	}

	raw, err := json.Marshal(dte)
	if err != nil {
		return dto.CreateExcludedSubjectInvoiceResponse{}, err
	}

	return dto.CreateExcludedSubjectInvoiceResponse{
		Success:          true,
		TipoDTE:          tipoDTESujetoExcluido,
		CodigoGeneracion: codigoGeneracion,
		NumeroControl:    numeroControl,
		TotalPagar:       resumen.TotalPagar,
		DTEJSON:          raw,
	}, nil
}

func (s *Service) createAdjustmentNote(req dto.CreateAdjustmentNoteRequest, tipoDTE string) (dto.CreateAdjustmentNoteResponse, error) {
	if err := validateAdjustmentNoteRequest(req); err != nil {
		return dto.CreateAdjustmentNoteResponse{}, err
	}
	spec, err := s.catalogs.GetDocumentSpec(tipoDTE)
	if err != nil {
		return dto.CreateAdjustmentNoteResponse{}, err
	}

	now := time.Now()
	fecEmi := firstNonEmpty(req.FecEmi, now.Format("2006-01-02"))
	horEmi := firstNonEmpty(req.HorEmi, now.Format("15:04:05"))
	ambiente := firstNonEmpty(req.Ambiente, ambienteTest)
	codigoGeneracion := strings.ToUpper(firstNonEmpty(req.CodigoGeneracion, uuid.NewString()))
	numeroControl := firstNonEmpty(req.NumeroControl, buildNumeroControlByTipo(tipoDTE, req.EstablecimientoTipo, req.Establecimiento, req.PuntoVenta, req.Correlativo))

	related := mapRelatedDocuments(req.DocumentoRelacionado)
	cuerpo, resumen := buildAdjustmentNoteItemsAndResumen(req.Items, related[0].NumeroDocumento, req.IVAPerci, req.IVARete)
	resumen.Observaciones = req.Observaciones
	resumen.CodigoRetencionMH = req.CodigoRetencionMH
	resumen.TotalLetras = totalEnLetras(resumen.TotalPagar)

	dte := domain.NotaAjuste{
		Identificacion: domain.IdentificacionNota{
			Version:          spec.Version,
			Ambiente:         ambiente,
			TipoDTE:          tipoDTE,
			NumeroControl:    numeroControl,
			CodigoGeneracion: codigoGeneracion,
			TipoModelo:       defaultInt(req.TipoModelo, modeloPrevio),
			TipoOperacion:    defaultInt(req.TipoOperacion, operacionNormal),
			TipoContingencia: nil,
			MotivoContin:     nil,
			FecEmi:           fecEmi,
			HorEmi:           horEmi,
			TipoMoneda:       monedaUSD,
			Fusion:           req.Fusion,
		},
		DocumentoRelacionado: related,
		Emisor:               finalizeEmisor(req.Emisor, req.Establecimiento, req.PuntoVenta),
		Receptor:             mapNoteReceptor(req.Receptor),
		VentaTercero:         nil,
		CuerpoDocumento:      cuerpo,
		Resumen:              resumen,
		Apendice:             mapApendice(req.Apendice),
	}

	raw, err := json.Marshal(dte)
	if err != nil {
		return dto.CreateAdjustmentNoteResponse{}, err
	}

	return dto.CreateAdjustmentNoteResponse{
		Success:          true,
		TipoDTE:          tipoDTE,
		CodigoGeneracion: codigoGeneracion,
		NumeroControl:    numeroControl,
		TotalPagar:       resumen.TotalPagar,
		DTEJSON:          raw,
	}, nil
}

func validateConsumerInvoiceRequest(req dto.CreateConsumerInvoiceRequest) error {
	if err := validateEmisor(req.Emisor); err != nil {
		return err
	}
	return validateItems(req.Items)
}

func validateTaxCreditInvoiceRequest(req dto.CreateTaxCreditInvoiceRequest) error {
	if err := validateEmisor(req.Emisor); err != nil {
		return err
	}
	if strings.TrimSpace(req.Receptor.NIT) == "" {
		return errors.New("receptor.nit es requerido")
	}
	if strings.TrimSpace(req.Receptor.Nombre) == "" {
		return errors.New("receptor.nombre es requerido")
	}
	if strings.TrimSpace(req.Receptor.CodActividad) == "" {
		return errors.New("receptor.codActividad es requerido")
	}
	if strings.TrimSpace(req.Receptor.DescActividad) == "" {
		return errors.New("receptor.descActividad es requerido")
	}
	if strings.TrimSpace(req.Receptor.Direccion.Complemento) == "" {
		return errors.New("receptor.direccion.complemento es requerido")
	}
	return validateItems(req.Items)
}

func validateAdjustmentNoteRequest(req dto.CreateAdjustmentNoteRequest) error {
	if err := validateEmisor(req.Emisor); err != nil {
		return err
	}
	if len(req.DocumentoRelacionado) == 0 {
		return errors.New("documentoRelacionado es requerido")
	}
	for i, doc := range req.DocumentoRelacionado {
		if strings.TrimSpace(doc.TipoDocumento) == "" {
			return fmt.Errorf("documentoRelacionado[%d].tipoDocumento es requerido", i)
		}
		if doc.TipoGeneracion == 0 {
			return fmt.Errorf("documentoRelacionado[%d].tipoGeneracion es requerido", i)
		}
		if strings.TrimSpace(doc.NumeroDocumento) == "" {
			return fmt.Errorf("documentoRelacionado[%d].numeroDocumento es requerido", i)
		}
		if strings.TrimSpace(doc.FechaEmision) == "" {
			return fmt.Errorf("documentoRelacionado[%d].fechaEmision es requerido", i)
		}
	}
	if strings.TrimSpace(req.Receptor.TipoDocumento) == "" {
		return errors.New("receptor.tipoDocumento es requerido")
	}
	if strings.TrimSpace(req.Receptor.NumDocumento) == "" {
		return errors.New("receptor.numDocumento es requerido")
	}
	if strings.TrimSpace(req.Receptor.Nombre) == "" {
		return errors.New("receptor.nombre es requerido")
	}
	if strings.TrimSpace(req.Receptor.CodActividad) == "" {
		return errors.New("receptor.codActividad es requerido")
	}
	if strings.TrimSpace(req.Receptor.DescActividad) == "" {
		return errors.New("receptor.descActividad es requerido")
	}
	if strings.TrimSpace(req.Receptor.Direccion.Complemento) == "" {
		return errors.New("receptor.direccion.complemento es requerido")
	}
	return validateItems(req.Items)
}

func validateExportInvoiceRequest(req dto.CreateExportInvoiceRequest) error {
	if err := validateEmisor(req.Emisor); err != nil {
		return err
	}
	if strings.TrimSpace(req.Receptor.Nombre) == "" {
		return errors.New("receptor.nombre es requerido")
	}
	if strings.TrimSpace(req.Receptor.CodPais) == "" {
		return errors.New("receptor.codPais es requerido")
	}
	if strings.TrimSpace(req.Receptor.NombrePais) == "" {
		return errors.New("receptor.nombrePais es requerido")
	}
	if strings.TrimSpace(req.Receptor.Complemento) == "" {
		return errors.New("receptor.complemento es requerido")
	}
	return validateItems(req.Items)
}

func validateExcludedSubjectInvoiceRequest(req dto.CreateExcludedSubjectInvoiceRequest) error {
	if err := validateEmisor(req.Emisor); err != nil {
		return err
	}
	if strings.TrimSpace(req.Receptor.NumDocumento) == "" {
		return errors.New("receptor.numDocumento es requerido")
	}
	if strings.TrimSpace(req.Receptor.Nombre) == "" {
		return errors.New("receptor.nombre es requerido")
	}
	if strings.TrimSpace(req.Receptor.Direccion.Complemento) == "" {
		return errors.New("receptor.direccion.complemento es requerido")
	}
	return validateExcludedSubjectItems(req.Items)
}

func validateEmisor(emisor dto.EmisorInput) error {
	if strings.TrimSpace(emisor.NIT) == "" {
		return errors.New("emisor.nit es requerido")
	}
	if strings.TrimSpace(emisor.NRC) == "" {
		return errors.New("emisor.nrc es requerido")
	}
	if strings.TrimSpace(emisor.Nombre) == "" {
		return errors.New("emisor.nombre es requerido")
	}
	if strings.TrimSpace(emisor.CodActividad) == "" {
		return errors.New("emisor.codActividad es requerido")
	}
	if strings.TrimSpace(emisor.DescActividad) == "" {
		return errors.New("emisor.descActividad es requerido")
	}
	if strings.TrimSpace(emisor.Direccion.Complemento) == "" {
		return errors.New("emisor.direccion.complemento es requerido")
	}
	if strings.TrimSpace(emisor.Direccion.Departamento) == "" {
		return errors.New("emisor.direccion.departamento es requerido")
	}
	if strings.TrimSpace(emisor.Direccion.Municipio) == "" {
		return errors.New("emisor.direccion.municipio es requerido")
	}
	municipio := location.DteMunicipioCode(emisor.Direccion.Departamento, emisor.Direccion.Municipio, "")
	if municipio == "" || municipio == "00" {
		return errors.New("emisor.direccion.municipio invalido: configura un municipio valido del catalogo CAT-013 (2 digitos)")
	}
	if strings.TrimSpace(emisor.Telefono) == "" {
		return errors.New("emisor.telefono es requerido")
	}
	if strings.TrimSpace(emisor.Correo) == "" {
		return errors.New("emisor.correo es requerido")
	}
	return nil
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

func buildFacturaItemsAndResumen(items []dto.ItemInput) ([]domain.CuerpoDocumento, domain.Resumen) {
	cuerpo := make([]domain.CuerpoDocumento, 0, len(items))
	var totalNoSuj, totalExenta, totalGravada, totalDescu, totalNoGravado, totalIVA float64

	for i, item := range items {
		cantidad := round8(item.Cantidad)
		precio := round8(item.PrecioUni)
		montoDescu := round2(item.MontoDescu)
		ventaNoSuj := round2(item.VentaNoSuj)
		ventaExenta := round2(item.VentaExenta)
		ventaGravada := round2(item.VentaGravada)

		if ventaNoSuj == 0 && ventaExenta == 0 && ventaGravada == 0 && item.NoGravado == 0 {
			ventaGravada = round2(cantidad*precio - montoDescu)
		}

		ivaItem := round2(ventaGravada * ivaConsumidorFinal)
		tipoItem := defaultInt(item.TipoItem, 2)
		uniMedida := defaultInt(item.UniMedida, 59)

		cuerpo = append(cuerpo, domain.CuerpoDocumento{
			NumItem:         i + 1,
			TipoItem:        tipoItem,
			NumeroDocumento: item.NumeroDocumento,
			Codigo:          item.Codigo,
			CodTributo:      item.CodTributo,
			Descripcion:     item.Descripcion,
			Cantidad:        cantidad,
			UniMedida:       uniMedida,
			PrecioUni:       precio,
			MontoDescu:      montoDescu,
			VentaNoSuj:      ventaNoSuj,
			VentaExenta:     ventaExenta,
			VentaGravada:    ventaGravada,
			Tributos:        nil,
			PSV:             round2(item.PSV),
			NoGravado:       round2(item.NoGravado),
			IVAItem:         ivaItem,
		})

		totalNoSuj += ventaNoSuj
		totalExenta += ventaExenta
		totalGravada += ventaGravada
		totalDescu += montoDescu
		totalNoGravado += item.NoGravado
		totalIVA += ivaItem
	}

	subTotalVentas := round2(totalNoSuj + totalExenta + totalGravada)
	totalNoGravado = round2(totalNoGravado)
	totalPagar := round2(subTotalVentas + totalNoGravado)

	return cuerpo, domain.Resumen{
		TotalNoSuj:          round2(totalNoSuj),
		TotalExenta:         round2(totalExenta),
		TotalGravada:        round2(totalGravada),
		SubTotalVentas:      subTotalVentas,
		DescuNoSuj:          0,
		DescuExenta:         0,
		DescuGravada:        0,
		PorcentajeDescuento: 0,
		TotalDescu:          round2(totalDescu),
		Tributos:            nil,
		SubTotal:            subTotalVentas,
		IVARete:             0,
		MontoTotalOperacion: totalPagar,
		TotalNoGravado:      totalNoGravado,
		TotalPagar:          totalPagar,
		TotalIVA:            round2(totalIVA),
		SaldoFavor:          0,
		CondicionOperacion:  condicionContado,
		NumPagoElectronico:  nil,
	}
}

func buildCreditoFiscalItemsAndResumen(items []dto.ItemInput, ivaPerci float64, ivaRete float64) ([]domain.CuerpoDocumentoCreditoFiscal, domain.ResumenCreditoFiscal) {
	cuerpo := make([]domain.CuerpoDocumentoCreditoFiscal, 0, len(items))
	var totalNoSuj, totalExenta, totalGravada, totalDescu, totalNoGravado float64
	const ivaTributo = "20"

	for i, item := range items {
		cantidad := round8(item.Cantidad)
		precio := round8(item.PrecioUni)
		montoDescu := round2(item.MontoDescu)
		ventaNoSuj := round2(item.VentaNoSuj)
		ventaExenta := round2(item.VentaExenta)
		ventaGravada := round2(item.VentaGravada)

		if ventaNoSuj == 0 && ventaExenta == 0 && ventaGravada == 0 && item.NoGravado == 0 {
			ventaGravada = round2(cantidad*precio - montoDescu)
		}
		var tributos []string
		if ventaGravada > 0 {
			tributos = []string{ivaTributo}
		}

		cuerpo = append(cuerpo, domain.CuerpoDocumentoCreditoFiscal{
			NumItem:         i + 1,
			TipoItem:        defaultInt(item.TipoItem, 2),
			NumeroDocumento: item.NumeroDocumento,
			Codigo:          item.Codigo,
			CodTributo:      item.CodTributo,
			Descripcion:     item.Descripcion,
			Cantidad:        cantidad,
			UniMedida:       defaultInt(item.UniMedida, 59),
			PrecioUni:       precio,
			MontoDescu:      montoDescu,
			VentaNoSuj:      ventaNoSuj,
			VentaExenta:     ventaExenta,
			VentaGravada:    ventaGravada,
			Tributos:        tributos,
			PSV:             round2(item.PSV),
			NoGravado:       round2(item.NoGravado),
		})

		totalNoSuj += ventaNoSuj
		totalExenta += ventaExenta
		totalGravada += ventaGravada
		totalDescu += montoDescu
		totalNoGravado += item.NoGravado
	}

	subTotalVentas := round2(totalNoSuj + totalExenta + totalGravada)
	totalNoGravado = round2(totalNoGravado)
	ivaPerci = round2(ivaPerci)
	ivaRete = round2(ivaRete)
	totalIVA := round2(totalGravada * 0.13)
	montoTotalOperacion := round2(subTotalVentas + totalIVA + totalNoGravado)
	totalPagar := round2(montoTotalOperacion + ivaPerci - ivaRete)
	var tributos any
	if totalIVA > 0 {
		tributos = []domain.TributoResumen{{
			Codigo:      ivaTributo,
			Descripcion: "Impuesto al Valor Agregado 13%",
			Valor:       totalIVA,
		}}
	}

	return cuerpo, domain.ResumenCreditoFiscal{
		TotalNoSuj:          round2(totalNoSuj),
		TotalExenta:         round2(totalExenta),
		TotalGravada:        round2(totalGravada),
		SubTotalVentas:      subTotalVentas,
		DescuNoSuj:          0,
		DescuExenta:         0,
		DescuGravada:        0,
		PorcentajeDescuento: 0,
		TotalDescu:          round2(totalDescu),
		Tributos:            tributos,
		SubTotal:            subTotalVentas,
		IVAPerci:            ivaPerci,
		IVARete:             ivaRete,
		MontoTotalOperacion: montoTotalOperacion,
		TotalNoGravado:      totalNoGravado,
		TotalPagar:          totalPagar,
		SaldoFavor:          0,
		CondicionOperacion:  condicionContado,
		NumPagoElectronico:  nil,
	}
}

func buildAdjustmentNoteItemsAndResumen(items []dto.ItemInput, defaultRelatedDocument string, ivaPerci float64, ivaRete float64) ([]domain.CuerpoDocumentoNota, domain.ResumenNota) {
	cuerpo := make([]domain.CuerpoDocumentoNota, 0, len(items))
	var totalNoSuj, totalExenta, totalGravada, totalDescu, totalNoGravado, totalIVA float64
	const ivaTributo = "20"

	for i, item := range items {
		cantidad := round8(item.Cantidad)
		precio := round8(item.PrecioUni)
		montoDescu := round2(item.MontoDescu)
		ventaNoSuj := round2(item.VentaNoSuj)
		ventaExenta := round2(item.VentaExenta)
		ventaGravada := round2(item.VentaGravada)

		if ventaNoSuj == 0 && ventaExenta == 0 && ventaGravada == 0 && item.NoGravado == 0 {
			ventaGravada = round2(cantidad*precio - montoDescu)
		}
		var tributos []string
		if ventaGravada > 0 {
			tributos = []string{ivaTributo}
		}

		itemIVAPerci := 0.0
		itemIVARete := 0.0
		if len(items) == 1 {
			itemIVAPerci = round2(ivaPerci)
			itemIVARete = round2(ivaRete)
		}
		totalIva := 0.0
		numeroDocumento := defaultRelatedDocument
		if item.NumeroDocumento != nil && strings.TrimSpace(*item.NumeroDocumento) != "" {
			numeroDocumento = strings.TrimSpace(*item.NumeroDocumento)
		}

		cuerpo = append(cuerpo, domain.CuerpoDocumentoNota{
			NumItem:         i + 1,
			TipoItem:        defaultInt(item.TipoItem, 2),
			NumeroDocumento: numeroDocumento,
			Cantidad:        cantidad,
			Codigo:          item.Codigo,
			CodTributo:      item.CodTributo,
			UniMedida:       defaultInt(item.UniMedida, 59),
			Descripcion:     item.Descripcion,
			PrecioUni:       precio,
			MontoDescu:      montoDescu,
			VentaNoSuj:      ventaNoSuj,
			VentaExenta:     ventaExenta,
			VentaGravada:    ventaGravada,
			Tributos:        tributos,
			NoGravado:       round2(item.NoGravado),
			IVAPerci:        itemIVAPerci,
			TotalIVA:        totalIva,
			IVARete:         itemIVARete,
		})

		totalNoSuj += ventaNoSuj
		totalExenta += ventaExenta
		totalGravada += ventaGravada
		totalDescu += montoDescu
		totalNoGravado += item.NoGravado
		totalIVA += totalIva
	}

	subTotalVentas := round2(totalNoSuj + totalExenta + totalGravada)
	totalNoGravado = round2(totalNoGravado)
	ivaPerci = round2(ivaPerci)
	ivaRete = round2(ivaRete)
	totalIVA = round2(totalIVA)
	ivaTributoTotal := round2(totalGravada * 0.13)
	montoTotalOperacion := round2(subTotalVentas + ivaTributoTotal + totalNoGravado)
	totalPagar := round2(montoTotalOperacion + ivaPerci - ivaRete)
	var tributos any
	if ivaTributoTotal > 0 {
		tributos = []domain.TributoResumen{{
			Codigo:      ivaTributo,
			Descripcion: "Impuesto al Valor Agregado 13%",
			Valor:       ivaTributoTotal,
		}}
	}

	return cuerpo, domain.ResumenNota{
		TotalNoSuj:          round2(totalNoSuj),
		TotalExenta:         round2(totalExenta),
		TotalGravada:        round2(totalGravada),
		SubTotalVentas:      subTotalVentas,
		TotalDescu:          round2(totalDescu),
		Tributos:            tributos,
		MontoTotalOperacion: montoTotalOperacion,
		IVAPerci:            ivaPerci,
		TotalIVA:            totalIVA,
		IVARete:             ivaRete,
		TotalNoGravado:      totalNoGravado,
		TotalPagar:          totalPagar,
		CondicionOperacion:  condicionContado,
	}
}

func buildExportItemsAndResumen(items []dto.ItemInput, flete float64, seguro float64) ([]domain.CuerpoDocumentoExportacion, domain.ResumenExportacion) {
	cuerpo := make([]domain.CuerpoDocumentoExportacion, 0, len(items))
	var totalGravada, totalDescu, totalNoGravado float64

	for i, item := range items {
		cantidad := round8(item.Cantidad)
		precio := round8(item.PrecioUni)
		montoDescu := round2(item.MontoDescu)
		ventaGravada := round2(item.VentaGravada)
		if ventaGravada == 0 && item.NoGravado == 0 {
			ventaGravada = round2(cantidad*precio - montoDescu)
		}

		tributos := []string(nil)
		if ventaGravada > 0 {
			tributos = []string{"C3"}
		}

		cuerpo = append(cuerpo, domain.CuerpoDocumentoExportacion{
			NumItem:      i + 1,
			Cantidad:     cantidad,
			Codigo:       item.Codigo,
			UniMedida:    defaultInt(item.UniMedida, 59),
			Descripcion:  item.Descripcion,
			PrecioUni:    precio,
			MontoDescu:   montoDescu,
			VentaGravada: ventaGravada,
			Tributos:     tributos,
			NoGravado:    round2(item.NoGravado),
		})

		totalGravada += ventaGravada
		totalDescu += montoDescu
		totalNoGravado += item.NoGravado
	}

	totalGravada = round2(totalGravada)
	totalNoGravado = round2(totalNoGravado)
	flete = round2(flete)
	seguro = round2(seguro)
	montoTotalOperacion := round2(totalGravada + totalNoGravado + flete + seguro)

	return cuerpo, domain.ResumenExportacion{
		TotalGravada:        totalGravada,
		PorcentajeDescuento: 0,
		TotalDescu:          round2(totalDescu),
		MontoTotalOperacion: montoTotalOperacion,
		TotalNoGravado:      totalNoGravado,
		TotalPagar:          montoTotalOperacion,
		CondicionOperacion:  condicionContado,
		Flete:               flete,
		Seguro:              seguro,
	}
}

func buildExcludedSubjectItemsAndResumen(items []dto.ExcludedSubjectItemInput, reteRenta float64) ([]domain.CuerpoDocumentoSujetoExcluido, domain.ResumenSujetoExcluido) {
	cuerpo := make([]domain.CuerpoDocumentoSujetoExcluido, 0, len(items))
	var totalCompra, totalDescu float64

	for i, item := range items {
		cantidad := round8(item.Cantidad)
		precio := round8(item.PrecioUni)
		montoDescu := round2(item.MontoDescu)
		compra := round2(item.Compra)
		if compra == 0 {
			compra = round2(cantidad*precio - montoDescu)
		}

		cuerpo = append(cuerpo, domain.CuerpoDocumentoSujetoExcluido{
			NumItem:     i + 1,
			TipoItem:    defaultInt(item.TipoItem, 2),
			Cantidad:    cantidad,
			Codigo:      item.Codigo,
			UniMedida:   defaultInt(item.UniMedida, 59),
			Descripcion: item.Descripcion,
			PrecioUni:   precio,
			MontoDescu:  montoDescu,
			Compra:      compra,
		})

		totalCompra += compra
		totalDescu += montoDescu
	}

	totalCompra = round2(totalCompra)
	totalDescu = round2(totalDescu)
	reteRenta = round2(reteRenta)
	totalPagar := round2(totalCompra - reteRenta)

	return cuerpo, domain.ResumenSujetoExcluido{
		TotalCompra:        totalCompra,
		Descu:              0,
		TotalDescu:         totalDescu,
		SubTotal:           totalCompra,
		ReteRenta:          reteRenta,
		TotalPagar:         totalPagar,
		CondicionOperacion: condicionContado,
	}
}

func normalizePagos(inputs []dto.PagoInput, totalPagar float64) []domain.Pago {
	if len(inputs) == 0 {
		code := formaPagoEfectivo
		return []domain.Pago{{
			Codigo:     &code,
			MontoPago:  totalPagar,
			Referencia: nil,
			Plazo:      nil,
			Periodo:    nil,
		}}
	}

	pagos := make([]domain.Pago, 0, len(inputs))
	for _, input := range inputs {
		monto := input.MontoPago
		if monto == 0 {
			monto = totalPagar
		}
		pagos = append(pagos, domain.Pago{
			Codigo:     input.Codigo,
			MontoPago:  round2(monto),
			Referencia: input.Referencia,
			Plazo:      input.Plazo,
			Periodo:    input.Periodo,
		})
	}
	return pagos
}

func mapEmisor(input dto.EmisorInput) domain.Emisor {
	return domain.Emisor{
		NIT:             input.NIT,
		NRC:             input.NRC,
		Nombre:          input.Nombre,
		CodActividad:    input.CodActividad,
		DescActividad:   input.DescActividad,
		NombreComercial: input.NombreComercial,
		Direccion:       mapDireccion(input.Direccion),
		Telefono:        input.Telefono,
		Correo:          input.Correo,
		CodEstable:      input.CodEstable,
		CodPuntoVenta:   input.CodPuntoVenta,
	}
}

func finalizeEmisor(input dto.EmisorInput, establecimientoCodigo, puntoVentaCodigo string) domain.Emisor {
	emisor := mapEmisor(input)
	codEstable := leftPadDigits(firstNonEmpty(ptrString(input.CodEstable), establecimientoCodigo, "0001"), 4)
	codPuntoVenta := leftPadDigits(firstNonEmpty(ptrString(input.CodPuntoVenta), puntoVentaCodigo, "0001"), 4)
	emisor.CodEstable = &codEstable
	emisor.CodPuntoVenta = &codPuntoVenta
	return emisor
}

func ptrString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func mapDireccion(input dto.Direccion) domain.Direccion {
	dept, muni, dist, comp := location.MapDteDireccion(
		input.Departamento,
		input.Municipio,
		input.Distrito,
		input.Complemento,
		input.Municipio,
	)
	return domain.Direccion{
		Departamento: dept,
		Municipio:    muni,
		Distrito:     dist,
		Complemento:  comp,
	}
}

func mapEmisorDireccion(input dto.Direccion) domain.Direccion {
	dept, muni, comp := location.MapEmisorDteDireccion(
		input.Departamento,
		input.Municipio,
		input.Complemento,
		input.Municipio,
	)
	return domain.Direccion{
		Departamento: dept,
		Municipio:    muni,
		Complemento:  comp,
	}
}

func mapOptionalDireccion(input *dto.Direccion) *domain.Direccion {
	if input == nil {
		return nil
	}
	direccion := mapDireccion(*input)
	return &direccion
}

func mapExportReceptor(input dto.ExportReceptorInput) domain.ReceptorExportacion {
	return domain.ReceptorExportacion{
		TipoDocumento:   input.TipoDocumento,
		NumDocumento:    input.NumDocumento,
		TipoPersona:     defaultInt(input.TipoPersona, 2),
		Nombre:          input.Nombre,
		NombreComercial: input.NombreComercial,
		CodPais:         input.CodPais,
		NombrePais:      input.NombrePais,
		Complemento:     input.Complemento,
		DescActividad:   input.DescActividad,
		Telefono:        input.Telefono,
		Correo:          input.Correo,
	}
}

func mapExportOtherDocuments(input []dto.ExportOtherDocument) any {
	if len(input) == 0 {
		return nil
	}
	out := make([]domain.OtrosDocumentosExportacion, 0, len(input))
	for _, item := range input {
		out = append(out, domain.OtrosDocumentosExportacion{
			CodDocAsociado:   item.CodDocAsociado,
			DescDocumento:    item.DescDocumento,
			DetalleDocumento: item.DetalleDocumento,
			ModoTransp:       item.ModoTransp,
			PlacaTrans:       item.PlacaTrans,
			NumConductor:     item.NumConductor,
			NombreConductor:  item.NombreConductor,
		})
	}
	return out
}

func mapVentaTercero(input *dto.VentaTerceroInput) any {
	if input == nil || strings.TrimSpace(input.NIT) == "" || strings.TrimSpace(input.Nombre) == "" {
		return nil
	}
	return domain.VentaTercero{
		NIT:    input.NIT,
		Nombre: input.Nombre,
	}
}

func mapReceptor(input dto.ReceptorInput) *domain.Receptor {
	if input.TipoDocumento == nil && input.NumDocumento == nil && input.Nombre == nil && input.Correo == nil {
		return &domain.Receptor{}
	}

	return &domain.Receptor{
		TipoDocumento: input.TipoDocumento,
		NumDocumento:  input.NumDocumento,
		NRC:           input.NRC,
		Nombre:        input.Nombre,
		CodActividad:  input.CodActividad,
		DescActividad: input.DescActividad,
		Direccion:     mapOptionalDireccion(input.Direccion),
		Telefono:      input.Telefono,
		Correo:        input.Correo,
	}
}

func mapTaxCreditReceptor(input dto.TaxCreditReceptorInput) domain.ReceptorCreditoFiscal {
	return domain.ReceptorCreditoFiscal{
		NIT:             input.NIT,
		NRC:             input.NRC,
		Nombre:          input.Nombre,
		CodActividad:    input.CodActividad,
		DescActividad:   input.DescActividad,
		NombreComercial: input.NombreComercial,
		Direccion:       mapDireccion(input.Direccion),
		Telefono: input.Telefono,
		Correo:   input.Correo,
	}
}

func mapRelatedDocuments(inputs []dto.RelatedDocumentInput) []domain.DocumentoRelacionado {
	out := make([]domain.DocumentoRelacionado, 0, len(inputs))
	for _, input := range inputs {
		out = append(out, domain.DocumentoRelacionado{
			TipoDocumento:   strings.TrimSpace(input.TipoDocumento),
			TipoGeneracion:  input.TipoGeneracion,
			NumeroDocumento: strings.TrimSpace(input.NumeroDocumento),
			FechaEmision:    strings.TrimSpace(input.FechaEmision),
		})
	}
	return out
}

func mapNoteReceptor(input dto.NoteReceptorInput) domain.ReceptorNota {
	return domain.ReceptorNota{
		TipoDocumento:   input.TipoDocumento,
		NumDocumento:    input.NumDocumento,
		NRC:             input.NRC,
		Nombre:          input.Nombre,
		CodActividad:    input.CodActividad,
		DescActividad:   input.DescActividad,
		NombreComercial: input.NombreComercial,
		Direccion:       mapDireccion(input.Direccion),
		Telefono: input.Telefono,
		Correo:   input.Correo,
	}
}

func mapExcludedSubjectIssuer(input dto.EmisorInput) domain.EmisorSujetoExcluido {
	return domain.EmisorSujetoExcluido{
		NIT:           input.NIT,
		NRC:           input.NRC,
		Nombre:        input.Nombre,
		CodActividad:  input.CodActividad,
		DescActividad: input.DescActividad,
		Direccion:       mapDireccion(input.Direccion),
		Telefono:      input.Telefono,
		CodEstable:    input.CodEstable,
		CodPuntoVenta: input.CodPuntoVenta,
		Correo:        input.Correo,
	}
}

func mapExcludedSubjectReceptor(input dto.ExcludedSubjectReceptorInput) domain.ReceptorSujetoExcluido {
	return domain.ReceptorSujetoExcluido{
		TipoDocumento: input.TipoDocumento,
		NumDocumento:  input.NumDocumento,
		Nombre:        input.Nombre,
		CodActividad:  input.CodActividad,
		DescActividad: input.DescActividad,
		Direccion:       mapDireccion(input.Direccion),
		Telefono: input.Telefono,
		Correo:   input.Correo,
	}
}

func mapApendice(input []dto.Apendice) any {
	if len(input) == 0 {
		return nil
	}
	return input
}

func buildNumeroControl(req dto.CreateConsumerInvoiceRequest) string {
	return buildNumeroControlByTipo(tipoDTEFactura, req.EstablecimientoTipo, req.Establecimiento, req.PuntoVenta, req.Correlativo)
}

func buildNumeroControlByTipo(tipoDTE string, establecimientoTipo string, establecimientoCodigo string, puntoVentaCodigo string, correlativo int64) string {
	tipo := firstNonEmpty(establecimientoTipo, "M")
	establecimiento := leftPadDigits(firstNonEmpty(establecimientoCodigo, "001"), 3)
	puntoVenta := leftPadDigits(firstNonEmpty(puntoVentaCodigo, "001"), 3)
	if correlativo <= 0 {
		correlativo = time.Now().UnixNano() % 1000000000000000
	}
	return fmt.Sprintf("DTE-%s-%s%sP%s-%015d", tipoDTE, tipo, establecimiento, puntoVenta, correlativo)
}

func totalEnLetras(total float64) string {
	entero := int64(total)
	centavos := int(math.Round((total - float64(entero)) * 100))
	if centavos == 100 {
		entero++
		centavos = 0
	}
	return strings.ToUpper(fmt.Sprintf("%s DOLARES CON %02d/100", numeroEnLetras(entero), centavos))
}

func numeroEnLetras(n int64) string {
	if n == 0 {
		return "cero"
	}
	if n < 0 {
		return "menos " + numeroEnLetras(-n)
	}
	if n < 1000 {
		return cientos(int(n))
	}
	if n < 1000000 {
		miles := n / 1000
		resto := n % 1000
		prefix := "mil"
		if miles > 1 {
			prefix = numeroEnLetras(miles) + " mil"
		}
		if resto == 0 {
			return prefix
		}
		return prefix + " " + numeroEnLetras(resto)
	}
	millones := n / 1000000
	resto := n % 1000000
	prefix := "un millon"
	if millones > 1 {
		prefix = numeroEnLetras(millones) + " millones"
	}
	if resto == 0 {
		return prefix
	}
	return prefix + " " + numeroEnLetras(resto)
}

func cientos(n int) string {
	unidades := []string{"", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"}
	especiales := map[int]string{10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince", 20: "veinte"}
	decenas := []string{"", "", "veinti", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"}
	centenas := []string{"", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"}
	if n == 100 {
		return "cien"
	}
	if n >= 100 {
		resto := n % 100
		if resto == 0 {
			return centenas[n/100]
		}
		return centenas[n/100] + " " + cientos(resto)
	}
	if val, ok := especiales[n]; ok {
		return val
	}
	if n < 10 {
		return unidades[n]
	}
	if n < 20 {
		return "dieci" + unidades[n-10]
	}
	if n < 30 {
		return decenas[2] + unidades[n-20]
	}
	d := n / 10
	u := n % 10
	if u == 0 {
		return decenas[d]
	}
	return decenas[d] + " y " + unidades[u]
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func defaultInt(value int, fallback int) int {
	if value == 0 {
		return fallback
	}
	return value
}

func leftPadDigits(value string, width int) string {
	clean := strings.TrimSpace(value)
	for len(clean) < width {
		clean = "0" + clean
	}
	if len(clean) > width {
		return clean[len(clean)-width:]
	}
	return clean
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

func round8(value float64) float64 {
	return math.Round(value*100000000) / 100000000
}

func (s *Service) CreateExtendedTaxDocument(req dto.CreateTaxCreditInvoiceRequest, tipoDte string) (dto.CreateTaxCreditInvoiceResponse, error) {
	if err := validateTaxCreditInvoiceRequest(req); err != nil {
		return dto.CreateTaxCreditInvoiceResponse{}, err
	}
	spec, err := s.catalogs.GetDocumentSpec(tipoDte)
	if err != nil {
		return dto.CreateTaxCreditInvoiceResponse{}, err
	}

	now := time.Now()
	fecEmi := firstNonEmpty(req.FecEmi, now.Format("2006-01-02"))
	horEmi := firstNonEmpty(req.HorEmi, now.Format("15:04:05"))
	ambiente := firstNonEmpty(req.Ambiente, ambienteTest)
	codigoGeneracion := strings.ToUpper(firstNonEmpty(req.CodigoGeneracion, uuid.NewString()))
	numeroControl := firstNonEmpty(req.NumeroControl, buildNumeroControlByTipo(tipoDte, req.EstablecimientoTipo, req.Establecimiento, req.PuntoVenta, req.Correlativo))

	cuerpo, resumen := buildCreditoFiscalItemsAndResumen(req.Items, req.IVAPerci, req.IVARete)
	resumen.Pagos = normalizePagos(req.Pagos, resumen.TotalPagar)
	resumen.Observaciones = req.Observaciones
	resumen.TotalLetras = totalEnLetras(resumen.TotalPagar)

	dte := domain.ComprobanteCreditoFiscal{
		Identificacion: domain.Identificacion{
			Version:          spec.Version,
			Ambiente:         ambiente,
			TipoDTE:          tipoDte,
			NumeroControl:    numeroControl,
			CodigoGeneracion: codigoGeneracion,
			TipoModelo:       defaultInt(req.TipoModelo, modeloPrevio),
			TipoOperacion:    defaultInt(req.TipoOperacion, operacionNormal),
			TipoContingencia: nil,
			MotivoContin:     nil,
			FecEmi:           fecEmi,
			HorEmi:           horEmi,
			TipoMoneda:       monedaUSD,
		},
		Emisor:          finalizeEmisor(req.Emisor, req.Establecimiento, req.PuntoVenta),
		Receptor:        mapTaxCreditReceptor(req.Receptor),
		CuerpoDocumento: cuerpo,
		Resumen:         resumen,
		Apendice:        mapApendice(req.Apendice),
	}

	raw, err := json.Marshal(dte)
	if err != nil {
		return dto.CreateTaxCreditInvoiceResponse{}, err
	}

	return dto.CreateTaxCreditInvoiceResponse{
		Success:          true,
		TipoDTE:          tipoDte,
		CodigoGeneracion: codigoGeneracion,
		NumeroControl:    numeroControl,
		TotalPagar:       resumen.TotalPagar,
		DTEJSON:          raw,
	}, nil
}
