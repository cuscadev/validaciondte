package emisores

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"verificador-dte/go-dte-api/internal/modules/emisores/dto"
)

var (
	ErrNotFound = errors.New("emisor no encontrado")
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) GetByFirebaseUID(ctx context.Context, firebaseUID, email string) (*dto.EmisorRow, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			e.id, e.nit, e.nrc, e.nombre, e.nombre_comercial, e.razon_social,
			e.tipo_establecimiento_codigo, e.codigo_actividad,
			COALESCE(NULLIF(BTRIM(e.descripcion_actividad), ''), a.nombre) AS descripcion_actividad,
			e.departamento_codigo, e.municipio_codigo, e.distrito_codigo,
			e.complemento_direccion, e.telefono, e.correo, e.ambiente_codigo,
			e.certificado_path,
			COALESCE(NULLIF(BTRIM(ec.cod_estable), ''), '001') AS cod_estable,
			COALESCE(NULLIF(BTRIM(ec.cod_punto_venta), ''), '001') AS cod_punto_venta,
			COALESCE(NULLIF(BTRIM(ec.tipo_establecimiento_emision), ''), NULLIF(BTRIM(e.tipo_establecimiento_codigo), ''), 'M') AS tipo_establecimiento_emision
		FROM usuarios u
		INNER JOIN usuario_emisor ue ON ue.usuario_id = u.id
		INNER JOIN emisores e ON e.id = ue.emisor_id
		LEFT JOIN cat_024_codigo_actividad a ON a.codigo = e.codigo_actividad
		LEFT JOIN emisor_configuracion ec ON ec.emisor_id = e.id
		WHERE u.activo = TRUE AND e.activo = TRUE
		  AND (u.firebase_uid = $1 OR lower(u.email) = lower($2))
		ORDER BY CASE ue.rol WHEN 'propietario' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, e.id ASC
		LIMIT 1
	`, firebaseUID, email)

	var emisor dto.EmisorRow
	err := row.Scan(
		&emisor.ID, &emisor.NIT, &emisor.NRC, &emisor.Nombre, &emisor.NombreComercial, &emisor.RazonSocial,
		&emisor.TipoEstablecimientoCodigo, &emisor.CodigoActividad, &emisor.DescripcionActividad,
		&emisor.DepartamentoCodigo, &emisor.MunicipioCodigo, &emisor.DistritoCodigo,
		&emisor.ComplementoDireccion, &emisor.Telefono, &emisor.Correo, &emisor.AmbienteCodigo,
		&emisor.CertificadoPath, &emisor.CodEstable, &emisor.CodPuntoVenta, &emisor.TipoEstablecimientoEmision,
	)
	if err != nil {
		return nil, ErrNotFound
	}
	return &emisor, nil
}

func (s *Store) GetByID(ctx context.Context, id int) (*dto.EmisorRow, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			e.id, e.nit, e.nrc, e.nombre, e.nombre_comercial, e.razon_social,
			e.tipo_establecimiento_codigo, e.codigo_actividad, e.descripcion_actividad,
			e.departamento_codigo, e.municipio_codigo, e.distrito_codigo,
			e.complemento_direccion, e.telefono, e.correo, e.ambiente_codigo,
			e.certificado_path,
			COALESCE(NULLIF(BTRIM(ec.cod_estable), ''), '001'),
			COALESCE(NULLIF(BTRIM(ec.cod_punto_venta), ''), '001'),
			COALESCE(NULLIF(BTRIM(ec.tipo_establecimiento_emision), ''), NULLIF(BTRIM(e.tipo_establecimiento_codigo), ''), 'M')
		FROM emisores e
		LEFT JOIN emisor_configuracion ec ON ec.emisor_id = e.id
		WHERE e.id = $1 AND e.activo = TRUE
		LIMIT 1
	`, id)

	var emisor dto.EmisorRow
	err := row.Scan(
		&emisor.ID, &emisor.NIT, &emisor.NRC, &emisor.Nombre, &emisor.NombreComercial, &emisor.RazonSocial,
		&emisor.TipoEstablecimientoCodigo, &emisor.CodigoActividad, &emisor.DescripcionActividad,
		&emisor.DepartamentoCodigo, &emisor.MunicipioCodigo, &emisor.DistritoCodigo,
		&emisor.ComplementoDireccion, &emisor.Telefono, &emisor.Correo, &emisor.AmbienteCodigo,
		&emisor.CertificadoPath, &emisor.CodEstable, &emisor.CodPuntoVenta, &emisor.TipoEstablecimientoEmision,
	)
	if err != nil {
		return nil, ErrNotFound
	}
	return &emisor, nil
}

func MapToDteInput(row *dto.EmisorRow) dto.DteEmisorInput {
	ptr := func(value *string) string {
		if value == nil {
			return ""
		}
		return strings.TrimSpace(*value)
	}
	return dto.DteEmisorInput{
		NIT:             strings.TrimSpace(row.NIT),
		NRC:             strings.TrimSpace(row.NRC),
		Nombre:          strings.TrimSpace(row.Nombre),
		CodActividad:    ptr(row.CodigoActividad),
		DescActividad:   ptr(row.DescripcionActividad),
		NombreComercial: row.NombreComercial,
		Direccion: dto.Direccion{
			Departamento: locationCode(ptr(row.DepartamentoCodigo)),
			Municipio:    locationCode(ptr(row.MunicipioCodigo)),
			Distrito:     locationCode(ptr(row.DistritoCodigo)),
			Complemento:  ptr(row.ComplementoDireccion),
		},
		Telefono:            ptr(row.Telefono),
		Correo:              ptr(row.Correo),
		CodEstable:          row.CodEstable,
		CodPuntoVenta:       row.CodPuntoVenta,
		TipoEstablecimiento: row.TipoEstablecimientoEmision,
	}
}

func locationCode(value string) string {
	var digits strings.Builder
	for _, r := range strings.TrimSpace(value) {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	out := digits.String()
	if out == "" {
		return ""
	}
	if len(out) > 2 {
		out = out[len(out)-2:]
	}
	for len(out) < 2 {
		out = "0" + out
	}
	return out
}
