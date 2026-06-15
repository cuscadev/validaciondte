# Base de Datos de Facturación Electrónica

## Descripción

Base de datos Docker con catálogos de facturación electrónica del Ministerio de Hacienda de El Salvador.

## Requisitos

- Docker
- Docker Compose

## Catálogos Incluidos

### CAT-012 / CAT-013 / CAT-008: Ubicación (Departamento, Municipio, Distrito)
- Catálogo oficial MH (reestructuración municipal 2023)
- Jerarquía en cascada: departamento → municipio → distrito
- Aplicar con `scripts/fix-ubicacion-flat.sql` o `npx tsx verificador-dte/scripts/run-ubicacion-flat-migration.ts`

### Tipos de Documento
- NIT, DUI, Pasaporte, etc.
- Códigos según normativa

### Tipos de Establecimiento
- Matriz, Sucursal, Agencia

### Códigos de Actividad Económica
- ISIC v4
- Códigos comunes de actividades económicas

### Países
- Listado de países con códigos ISO

## Iniciar la Base de Datos

```bash
# Desde la raíz del proyecto
docker-compose up -d

# Verificar que está corriendo
docker ps

# Ver logs
docker-compose logs -f facturacion-db
```

## Conectarse a la Base de Datos

### Con PostgreSQL CLI
```bash
psql -h localhost -U facturacion -d facturacion
```

### Credenciales
- **Usuario**: `facturacion`
- **Contraseña**: `facturacion123`
- **Base de datos**: `facturacion`
- **Puerto**: `5432`

### Con herramientas GUI
- **DBeaver**: postgresql://facturacion:facturacion123@localhost:5432/facturacion
- **pgAdmin**: Mismo usuario, contraseña y puerto

## Consultas Útiles

### Listar todos los departamentos
```sql
SELECT * FROM cat_012_departamento ORDER BY codigo;
```

### Listar distritos
```sql
SELECT * FROM cat_008_distrito WHERE departamento_codigo = '05' AND municipio_codigo = '28';
```

### Listar municipios de un departamento
```sql
SELECT m.* FROM cat_009_municipios m 
WHERE m.departamento_codigo = '05' AND m.activo = true;
```

### Listar códigos de actividad
```sql
SELECT * FROM cat_codigos_actividad WHERE activo = true;
```

### Ver log de auditoría
```sql
SELECT * FROM audit_log ORDER BY fecha DESC LIMIT 10;
```

## Detener la Base de Datos

```bash
docker-compose down

# Remover volúmenes (WARNING: borra datos)
docker-compose down -v
```

## Agregar Más Catálogos

Para agregar catálogos adicionales:

1. Editar `scripts/init-db.sql`
2. Agregar la tabla y datos
3. Recrear el contenedor:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

## Catálogos Pendientes por Agregar

- Centros de la DARA (distribuidores autorizados)
- Tipos de retención
- Tasas de impuesto
- Códigos de incidencia
- Tipos de venta
- Otros catálogos del Ministerio de Hacienda

## Estructura de Archivos

```
proyecto-root/
├── docker-compose.yml          # Configuración de Docker
└── scripts/
    └── init-db.sql             # Script de inicialización
```

## Notas

- Los datos iniciales están basados en catálogos oficiales del MH
- Es recomendable actualizar con el PDF de catálogos más reciente
- La base de datos persiste en el volumen `facturacion-data`
