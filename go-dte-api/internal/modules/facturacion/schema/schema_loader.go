package schema

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type svfeSchema struct {
	TipoDTE                string   `json:"tipoDte"`
	RequiredTopLevel       []string `json:"requiredTopLevel"`
	RequiredIdentificacion []string `json:"requiredIdentificacion"`
}

var svfeSchemas = loadSvfeSchemas()

func loadSvfeSchemas() map[string]svfeSchema {
	result := map[string]svfeSchema{}
	dirs := []string{
		"schemas/svfe-json-schemas",
		filepath.Join("..", "schemas", "svfe-json-schemas"),
		filepath.Join("go-dte-api", "schemas", "svfe-json-schemas"),
	}
	if cwd, err := os.Getwd(); err == nil {
		dirs = append(dirs, filepath.Join(cwd, "schemas", "svfe-json-schemas"))
	}

	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
			if err != nil {
				continue
			}
			var schema svfeSchema
			if err := json.Unmarshal(data, &schema); err != nil {
				continue
			}
			tipo := strings.TrimSpace(schema.TipoDTE)
			if tipo == "" {
				continue
			}
			result[tipo] = schema
		}
		if len(result) > 0 {
			break
		}
	}
	return result
}

func validateWithSvfeSchema(tipoDte string, body map[string]any) []string {
	schema, ok := svfeSchemas[strings.TrimSpace(tipoDte)]
	if !ok {
		return validateStructure(tipoDte, body)
	}

	var missing []string
	for _, key := range schema.RequiredTopLevel {
		if _, exists := body[key]; !exists {
			missing = append(missing, key+" es requerido")
		}
	}
	if ident, ok := body["identificacion"].(map[string]any); ok {
		for _, key := range schema.RequiredIdentificacion {
			if _, exists := ident[key]; !exists {
				missing = append(missing, "identificacion."+key+" es requerido")
			}
		}
		if value, _ := ident["tipoDte"].(string); value != "" && value != schema.TipoDTE {
			missing = append(missing, "identificacion.tipoDte no coincide")
		}
	}
	return missing
}
