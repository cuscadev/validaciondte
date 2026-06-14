package receptors

import (
	"errors"
	"fmt"
	"strings"

	"verificador-dte/go-dte-api/internal/modules/facturacion/catalogs"
	"verificador-dte/go-dte-api/internal/modules/facturacion/documents/domain"
	"verificador-dte/go-dte-api/internal/modules/facturacion/receptors/dto"
)

type Service struct {
	catalogs *catalogs.Service
}

func NewService(catalogService *catalogs.Service) *Service {
	return &Service{catalogs: catalogService}
}

func (s *Service) Build(req dto.BuildReceptorRequest) (dto.BuildReceptorResponse, error) {
	spec, err := s.catalogs.GetDocumentSpec(req.TipoDTE)
	if err != nil {
		return dto.BuildReceptorResponse{}, err
	}

	receptor, err := s.buildByKind(spec.ReceptorKind, req)
	if err != nil {
		return dto.BuildReceptorResponse{}, err
	}

	return dto.BuildReceptorResponse{
		Success:      true,
		TipoDTE:      spec.TipoDTE,
		ReceptorKind: spec.ReceptorKind,
		Receptor:     receptor,
	}, nil
}

func (s *Service) buildByKind(kind string, input dto.BuildReceptorRequest) (any, error) {
	switch kind {
	case catalogs.ReceptorConsumidorFinal:
		return domain.Receptor{
			TipoDocumento: input.TipoDocumento,
			NumDocumento:  firstStringPtr(input.NumDocumento, input.NIT),
			NRC:           input.NRC,
			Nombre:        input.Nombre,
			CodActividad:  input.CodActividad,
			DescActividad: input.DescActividad,
			Direccion:     mapOptionalDireccion(input.Direccion),
			Telefono:      input.Telefono,
			Correo:        input.Correo,
		}, nil
	case catalogs.ReceptorContribuyente:
		nit := strings.TrimSpace(firstString(input.NIT, input.NumDocumento))
		if nit == "" {
			return nil, errors.New("nit es requerido para credito fiscal")
		}
		if err := requireCommonTaxpayer(input, "credito fiscal"); err != nil {
			return nil, err
		}
		return domain.ReceptorCreditoFiscal{
			NIT:             nit,
			NRC:             input.NRC,
			Nombre:          ptrString(input.Nombre),
			CodActividad:    ptrString(input.CodActividad),
			DescActividad:   ptrString(input.DescActividad),
			NombreComercial: input.NombreComercial,
			Direccion:       mapDireccion(*input.Direccion),
			Telefono:        input.Telefono,
			Correo:          input.Correo,
		}, nil
	case catalogs.ReceptorNota:
		numDocumento := strings.TrimSpace(firstString(input.NumDocumento, input.NIT))
		if numDocumento == "" {
			return nil, errors.New("numDocumento es requerido para notas")
		}
		tipoDocumento := strings.TrimSpace(ptrString(input.TipoDocumento))
		if tipoDocumento == "" {
			tipoDocumento = inferTipoDocumento(numDocumento)
		}
		if tipoDocumento == "" {
			return nil, errors.New("tipoDocumento es requerido para notas")
		}
		if err := requireCommonTaxpayer(input, "notas"); err != nil {
			return nil, err
		}
		return domain.ReceptorNota{
			TipoDocumento:   tipoDocumento,
			NumDocumento:    numDocumento,
			NRC:             input.NRC,
			Nombre:          ptrString(input.Nombre),
			CodActividad:    ptrString(input.CodActividad),
			DescActividad:   ptrString(input.DescActividad),
			NombreComercial: input.NombreComercial,
			Direccion:       mapDireccion(*input.Direccion),
			Telefono:        input.Telefono,
			Correo:          input.Correo,
		}, nil
	case catalogs.ReceptorSujetoExcluido:
		numDocumento := strings.TrimSpace(firstString(input.NumDocumento, input.NIT))
		if numDocumento == "" {
			return nil, errors.New("numDocumento es requerido para sujeto excluido")
		}
		tipoDocumento := strings.TrimSpace(ptrString(input.TipoDocumento))
		if tipoDocumento == "" {
			tipoDocumento = inferTipoDocumento(numDocumento)
		}
		if tipoDocumento == "" {
			return nil, errors.New("tipoDocumento es requerido para sujeto excluido")
		}
		if strings.TrimSpace(ptrString(input.Nombre)) == "" {
			return nil, errors.New("nombre es requerido para sujeto excluido")
		}
		if input.Direccion == nil {
			return nil, errors.New("direccion es requerida para sujeto excluido")
		}
		return domain.ReceptorSujetoExcluido{
			TipoDocumento: &tipoDocumento,
			NumDocumento:  numDocumento,
			Nombre:        ptrString(input.Nombre),
			CodActividad:  input.CodActividad,
			DescActividad: input.DescActividad,
			Direccion:     mapDireccion(*input.Direccion),
			Telefono:      input.Telefono,
			Correo:        input.Correo,
		}, nil
	default:
		return nil, fmt.Errorf("tipo de receptor no soportado: %s", kind)
	}
}

func requireCommonTaxpayer(input dto.BuildReceptorRequest, label string) error {
	if strings.TrimSpace(ptrString(input.Nombre)) == "" {
		return fmt.Errorf("nombre es requerido para %s", label)
	}
	if strings.TrimSpace(ptrString(input.CodActividad)) == "" {
		return fmt.Errorf("codActividad es requerido para %s", label)
	}
	if strings.TrimSpace(ptrString(input.DescActividad)) == "" {
		return fmt.Errorf("descActividad es requerido para %s", label)
	}
	if input.Direccion == nil {
		return fmt.Errorf("direccion es requerida para %s", label)
	}
	return nil
}

func mapDireccion(input dto.Direccion) domain.Direccion {
	return domain.Direccion{
		Departamento: input.Departamento,
		Municipio:    input.Municipio,
		Distrito:     input.Distrito,
		Complemento:  input.Complemento,
	}
}

func mapOptionalDireccion(input *dto.Direccion) *domain.Direccion {
	if input == nil {
		return nil
	}
	direccion := mapDireccion(*input)
	return &direccion
}

func ptrString(input *string) string {
	if input == nil {
		return ""
	}
	return strings.TrimSpace(*input)
}

func firstString(values ...*string) string {
	for _, value := range values {
		if text := ptrString(value); text != "" {
			return text
		}
	}
	return ""
}

func firstStringPtr(values ...*string) *string {
	value := firstString(values...)
	if value == "" {
		return nil
	}
	return &value
}

func inferTipoDocumento(numDocumento string) string {
	switch len(onlyDigits(numDocumento)) {
	case 9:
		return "13"
	case 14:
		return "36"
	default:
		return ""
	}
}

func onlyDigits(value string) string {
	var builder strings.Builder
	for _, char := range value {
		if char >= '0' && char <= '9' {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}
