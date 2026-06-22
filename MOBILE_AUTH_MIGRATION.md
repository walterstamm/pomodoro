# Contrato de autenticación para React Native

La API usa access tokens opacos de 15 minutos y refresh tokens rotativos de
30 días. Ambos deben guardarse en Keychain/Keystore mediante una librería como
`expo-secure-store` o `react-native-keychain`; no usar `AsyncStorage`.

## Login y registro

Enviar siempre:

```http
X-Auth-Client: mobile
Content-Type: application/json
```

`POST /api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "password-seguro"
}
```

`POST /api/auth/register` mantiene los campos actuales:
`email`, `confirmEmail`, `password`, `confirmPassword`, `firstName`, `lastName`.

Respuesta:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresIn": 2592000,
  "user": {}
}
```

## Requests autenticados

```http
Authorization: Bearer ACCESS_TOKEN
```

No enviar tokens en query params. React Native no necesita configuración CORS.

## Renovación

Ante un `401`, ejecutar una sola renovación compartida entre requests:

`POST /api/auth/refresh`

```json
{
  "refreshToken": "REFRESH_TOKEN_ACTUAL"
}
```

Guardar atómicamente ambos tokens de la respuesta antes de reintentar una sola
vez la petición original. El refresh anterior queda invalidado inmediatamente.
Si refresh responde `401`, borrar credenciales y volver al login.

## Logout

`POST /api/auth/logout` con el access token en `Authorization` y, para cubrir
access tokens vencidos, el refresh token en JSON:

```json
{
  "refreshToken": "REFRESH_TOKEN_ACTUAL"
}
```

Para cerrar todas las sesiones del usuario:

```http
POST /api/auth/logout-all
Authorization: Bearer ACCESS_TOKEN
```

## Manejo de errores

- `400`: payload inválido.
- `401`: token ausente, vencido o inválido.
- `403`: origen web no autorizado.
- `409`: email ya registrado.
- `415`: `Content-Type` incorrecto.
- `429`: rate limit; respetar `Retry-After`.
