package shared

import "testing"

func TestIsSuccessfulConsulta(t *testing.T) {
	if !isSuccessfulConsulta(Result{OK: true, Estado: "EMITIDO"}) {
		t.Fatal("expected OK emitido")
	}
	if !isSuccessfulConsulta(Result{Estado: "NO ENCONTRADO"}) {
		t.Fatal("expected NO ENCONTRADO as successful consulta")
	}
	if isSuccessfulConsulta(Result{Estado: "ERROR", Error: "timeout"}) {
		t.Fatal("expected network error not successful")
	}
}
