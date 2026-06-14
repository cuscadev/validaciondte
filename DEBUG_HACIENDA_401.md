# Debugging HTTP 401 Error in Batch (Lote) Transmission to Hacienda

## Problem
You're getting: `"No se pudo transmitir chunk 1 a Hacienda HTTP 401"`

This means Hacienda is rejecting your request with Unauthorized (401).

## Root Causes (in order of probability)

### 1. **Incorrect NIT or Password** ❌ MOST LIKELY
- Go to Configuraciones → Hacienda
- Verify the NIT is **EXACT** (numbers only, no guiones)
- Verify the Password is **EXACT** (copy from official Hacienda credentials)
- Click "Probar Conexión" to verify credentials are correct

### 2. **Token is Expired**
- Tokens from Hacienda expire after ~1 hour
- The system should auto-refresh, but if credentials are wrong, it won't refresh
- Solution: Verify credentials first (#1), then try again

### 3. **Wrong Environment (Test vs Production)**
- Ensure you're using **TEST** environment
- In Configuraciones, select "Pruebas" (not "Producción")
- Environment variable should be: `HACIENDA_ENV=test`
- Do NOT attempt production until credentials are verified in test

### 4. **Endpoint Configuration**
- Check Go API is pointing to correct Hacienda test URL:
  - Batch endpoint: `https://apitest.dtes.mh.gob.sv/fesv/recepcionlote`
  - NOT: `https://api.dtes.mh.gob.sv/fesv/recepcionlote` (that's production)

## Verification Steps

### Step 1: Test Credentials
```
POST /api/hacienda/session
{
  "environment": "test",
  "forceRefresh": true
}
```
Expected: 200 OK with token info
If 401: Credentials are WRONG

### Step 2: Check Token Format
```
POST /api/test/hacienda-token-debug
{
  "environment": "test"
}
```
Expected: 
- `has_bearer: false` (token should NOT have "Bearer " prefix)
- `lastAuthStatus: "ok"` (authentication succeeded)
- `tokenExpiresAt`: future date

### Step 3: Check Go API Configuration
```
GET /api/facturacion/transmissions/debug?environment=test
Authorization: <your-token>
```
Expected:
- `hacienda_url`: `https://apitest.dtes.mh.gob.sv/fesv/recepcionlote`
- Token should be present and valid

## Common Mistakes

❌ Using production NIT with test credentials
❌ Typo in NIT (special characters, extra spaces)
❌ Copy-paste password with whitespace
❌ Using production URL while in test mode
❌ Token has "Bearer " prefix when it shouldn't

## Token Format Rules
- **Input from Hacienda auth**: `eyJhbGciOiJSUzUxMiJ9...` (raw JWT)
- **Sent to Go API**: `Authorization: eyJhbGciOiJSUzUxMiJ9...` (NO "Bearer ")
- **Sent to Hacienda**: `Authorization: eyJhbGciOiJSUzUxMiJ9...` (NO "Bearer ")

## Environment Variables
Set these to ensure test environment:
```
HACIENDA_ENV=test
HACIENDA_RECEPCION_LOTE_URL_TEST=https://apitest.dtes.mh.gob.sv/fesv/recepcionlote
```

## Next Steps
1. Verify NIT and password in Configuraciones
2. Click "Probar Conexión"
3. If that fails → credentials are wrong, contact Hacienda
4. If that passes → credentials are correct, but batch transmission might have a different issue
5. Run the verification steps above
6. If still 401 → contact support with the debug output
