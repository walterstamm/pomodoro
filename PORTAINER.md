# Despliegue en Portainer

Este proyecto publica la web y la API desde el mismo servicio Next.js. La web queda en `/` y la API en `/api/*`, por ejemplo `/api/health`.

## Variables del stack

Define estas variables en Portainer antes de desplegar:

```env
APP_ORIGIN=https://tu-dominio.com
ALLOWED_ORIGINS=
APP_PORT=3000
POSTGRES_USER=focopulse
POSTGRES_PASSWORD=cambia-esta-password
POSTGRES_DB=focopulse
```

- `APP_ORIGIN` debe ser la URL pública exacta, con `https://` y sin barra final.
- `ALLOWED_ORIGINS` normalmente queda vacío si la web consume la API desde el mismo dominio.
- Si otra app externa consume la API, agrega sus orígenes separados por coma, por ejemplo `https://app.tu-dominio.com,https://admin.tu-dominio.com`.
- No publiques el puerto de PostgreSQL; el compose ya deja la base sólo en la red interna.

## Stack

Puedes usar el `docker-compose.yml` del repositorio directamente en Portainer. El servicio `web` expone sólo el puerto interno `3000` dentro de Docker, y `db` queda privado.

El compose usa la red externa `proxy_net` para que Nginx pueda llegar al frontend/API sin publicar el puerto al host. En Nginx apunta el upstream a `http://focopulse-web:3000`.

Antes de levantar el stack, la red debe existir:

```bash
docker network create proxy_net
```

## Cómo cargarlo en Portainer

No pegues sólo el contenido del compose en el editor web si el stack tiene `build`. Portainer necesita ver también el `Dockerfile`, `package.json`, `src`, `prisma` y el resto del proyecto.

Usa una de estas opciones:

- **Git Repository**: recomendado. En Portainer crea el stack desde el repo Git y usa como compose path `docker-compose.yml`.
- **Imagen prebuild**: construye la imagen fuera de Portainer, súbela a un registry y cambia `build` por `image`.
- **Upload completo**: si tu Portainer lo permite, sube el proyecto completo, no sólo el YAML.

Si ves este error:

```text
failed to read dockerfile: open Dockerfile: no such file or directory
```

significa que Portainer está ejecutando el build en una carpeta donde no existe `Dockerfile`.

## Base de datos nueva

El stack levanta un PostgreSQL nuevo dentro de Docker. No usa la base local de desarrollo porque `DATABASE_URL` apunta a `db:5432`, que es el nombre del servicio interno del compose.

El compose ya define este volumen persistente:

```yaml
volumes:
  postgres_data:
```

Ese volumen guarda los datos reales de PostgreSQL en el host Docker. Si reinicias, actualizas o recreas el contenedor, los datos se mantienen.

Importante en Portainer:

- No borres el volumen `postgres_data` si eliminas el stack.
- No uses la opción de eliminar volúmenes al remover el stack.
- Usa una `POSTGRES_PASSWORD` fuerte desde el primer deploy y no la cambies después sin planificarlo.
- Si quieres máxima seguridad contra borrados accidentales, crea un volumen externo en Portainer y márcalo como `external`.

Ejemplo con volumen externo:

```yaml
volumes:
  postgres_data:
    external: true
    name: focopulse_postgres_data
```

En ese caso, crea primero el volumen `focopulse_postgres_data` desde Portainer o Docker, y luego despliega el stack.

## Backup recomendado

Antes de tocar el stack en producción, saca backup con `pg_dump`:

```bash
docker exec -t NOMBRE_CONTENEDOR_DB pg_dump -U focopulse -d focopulse > focopulse-backup.sql
```

Para restaurar:

```bash
docker exec -i NOMBRE_CONTENEDOR_DB psql -U focopulse -d focopulse < focopulse-backup.sql
```

## Prueba rápida

Después del deploy:

```bash
curl https://tu-dominio.com/api/health
```

La web debe abrir en:

```text
https://tu-dominio.com
```

Y desde el frontend conviene consumir la API con rutas relativas:

```ts
fetch("/api/projects")
```

Así evitas problemas de CORS y cookies.
