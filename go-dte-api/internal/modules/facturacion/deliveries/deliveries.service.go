package deliveries

import (
	"encoding/json"
	"errors"
	"strings"

	"verificador-dte/go-dte-api/internal/modules/facturacion/deliveries/dto"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) BuildPackage(req dto.BuildDeliveryRequest) (dto.BuildDeliveryResponse, error) {
	if strings.TrimSpace(req.TipoDTE) == "" {
		return dto.BuildDeliveryResponse{}, errors.New("tipoDte es requerido")
	}
	if len(req.DTEJSON) == 0 {
		return dto.BuildDeliveryResponse{}, errors.New("dteJson es requerido")
	}
	if strings.TrimSpace(req.Firma) == "" {
		return dto.BuildDeliveryResponse{}, errors.New("firma es requerida")
	}
	if strings.TrimSpace(req.SelloRecepcion) == "" {
		return dto.BuildDeliveryResponse{}, errors.New("selloRecepcion es requerido")
	}

	finalJSON, err := buildFinalJSON(req)
	if err != nil {
		return dto.BuildDeliveryResponse{}, err
	}

	codigo := strings.TrimSpace(req.CodigoGeneracion)
	return dto.BuildDeliveryResponse{
		Success:          true,
		TipoDTE:          strings.TrimSpace(req.TipoDTE),
		CodigoGeneracion: codigo,
		NumeroControl:    strings.TrimSpace(req.NumeroControl),
		SelloRecepcion:   strings.TrimSpace(req.SelloRecepcion),
		FinalJSON:        finalJSON,
		Downloads: dto.DownloadLinks{
			JSON: "/api/facturacion/deliveries/download/json",
			PDF:  "/api/facturacion/reports/export/pdf",
		},
	}, nil
}

func buildFinalJSON(req dto.BuildDeliveryRequest) (json.RawMessage, error) {
	var dte any
	if err := json.Unmarshal(req.DTEJSON, &dte); err != nil {
		return nil, errors.New("dteJson invalido")
	}

	var hacienda any
	if len(req.HaciendaResponse) > 0 {
		if err := json.Unmarshal(req.HaciendaResponse, &hacienda); err != nil {
			return nil, errors.New("haciendaResponse invalido")
		}
	}

	final := map[string]any{
		"tipoDte":          strings.TrimSpace(req.TipoDTE),
		"codigoGeneracion": strings.TrimSpace(req.CodigoGeneracion),
		"numeroControl":    strings.TrimSpace(req.NumeroControl),
		"dteJson":          dte,
		"firma":            strings.TrimSpace(req.Firma),
		"selloRecepcion":   strings.TrimSpace(req.SelloRecepcion),
		"haciendaResponse": hacienda,
	}

	return json.MarshalIndent(final, "", "  ")
}
