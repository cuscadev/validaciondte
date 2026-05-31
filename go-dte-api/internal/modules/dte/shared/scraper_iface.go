package shared

import "context"

// ConsultaScraper consulta un DTE en el portal público de Hacienda.
type ConsultaScraper interface {
	ConsultarDTE(ctx context.Context, rawURL string) Result
	Close()
}
