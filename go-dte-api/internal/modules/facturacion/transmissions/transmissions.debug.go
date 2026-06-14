package transmissions

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"

	"verificador-dte/go-dte-api/internal/modules/facturacion/transmissions/dto"
)

// DebugTransmitLote sends a batch to Hacienda with detailed logging
func (ct *Controller) DebugTransmitLote(c *fiber.Ctx) error {
	var req dto.TransmitLoteRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON invalido")
	}

	rawToken := strings.TrimSpace(c.Get("Authorization"))
	token := normalizeHaciendaToken(rawToken)

	// Log everything
	debugInfo := map[string]interface{}{
		"timestamp":      c.Context().Time().String(),
		"token_present":  token != "",
		"token_length":   len(token),
		"token_prefix":   "",
		"raw_has_bearer": strings.HasPrefix(strings.ToLower(rawToken), "bearer "),
		"environment":    req.Environment,
		"amplitude":      req.Ambiente,
		"nit_emisor":     req.NitEmisor,
		"documentos_len": len(req.Documentos),
		"hacienda_url":   ct.service.loteURL(req.Environment),
	}

	if len(token) > 50 {
		debugInfo["token_prefix"] = token[:50]
		debugInfo["token_suffix"] = token[len(token)-10:]
	} else if token != "" {
		debugInfo["token_full"] = token
	}

	// Validate payload
	payloadBody, err := ct.service.buildLotePayload(req)
	if err != nil {
		debugInfo["payload_error"] = err.Error()
		return c.JSON(fiber.Map{
			"error":      err.Error(),
			"debug_info": debugInfo,
			"status":     fiber.StatusBadRequest,
		})
	}

	debugInfo["payload_size"] = len(payloadBody)

	// Try to parse payload as JSON for inspection
	var payloadJSON map[string]interface{}
	if err := json.Unmarshal(payloadBody, &payloadJSON); err == nil {
		debugInfo["payload_parsed"] = true
		debugInfo["payload_keys"] = getKeys(payloadJSON)
		if docs, ok := payloadJSON["documentos"].([]interface{}); ok {
			debugInfo["documentos_count"] = len(docs)
			if len(docs) > 0 {
				if firstDoc, ok := docs[0].(map[string]interface{}); ok {
					debugInfo["first_document_keys"] = getKeys(firstDoc)
				}
			}
		}
	} else {
		debugInfo["payload_parsed"] = false
		debugInfo["parse_error"] = err.Error()
	}

	// Now make the actual request with logging
	haciendaURL := ct.service.loteURL(req.Environment)
	httpReq, err := http.NewRequestWithContext(c.Context(), http.MethodPost, haciendaURL, bytes.NewReader(payloadBody))
	if err != nil {
		debugInfo["request_error"] = err.Error()
		return c.JSON(fiber.Map{
			"error":      err.Error(),
			"debug_info": debugInfo,
			"status":     fiber.StatusInternalServerError,
		})
	}

	httpReq.Header.Set("Authorization", haciendaAuthorizationHeader(token))
	httpReq.Header.Set("User-Agent", ct.service.cfg.HaciendaUserAgent)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	debugInfo["request_headers"] = map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s... (jwtLen=%d)", token[:min(20, len(token))], len(token)),
		"User-Agent":    ct.service.cfg.HaciendaUserAgent,
		"Content-Type":  "application/json",
		"Accept":        "application/json",
	}

	// Make request
	client := &http.Client{}
	res, err := client.Do(httpReq)
	if err != nil {
		debugInfo["network_error"] = err.Error()
		return c.JSON(fiber.Map{
			"error":      err.Error(),
			"debug_info": debugInfo,
			"status":     fiber.StatusBadGateway,
		})
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		debugInfo["response_read_error"] = err.Error()
		return c.JSON(fiber.Map{
			"error":      err.Error(),
			"debug_info": debugInfo,
			"status":     fiber.StatusBadGateway,
		})
	}

	debugInfo["response_status"] = res.StatusCode
	debugInfo["response_headers"] = map[string]string{
		"Content-Type":   res.Header.Get("Content-Type"),
		"Content-Length": res.Header.Get("Content-Length"),
	}
	debugInfo["response_size"] = len(respBody)
	debugInfo["response_body_preview"] = string(respBody[:min(500, len(respBody))])

	var responseJSON interface{}
	json.Unmarshal(respBody, &responseJSON)
	debugInfo["response_parsed"] = responseJSON

	return c.JSON(fiber.Map{
		"success":         res.StatusCode >= 200 && res.StatusCode < 300,
		"response_status": res.StatusCode,
		"response_body":   responseJSON,
		"debug_info":      debugInfo,
	})
}

func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
