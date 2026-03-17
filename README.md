## Pomodo — Seguimiento Pomodoro por proyecto

Aplicación Next.js (App Router + Tailwind CSS v4) para medir tiempo con la técnica
Pomodoro y guardar cada sesión en PostgreSQL mediante Prisma.

### Requisitos
- Node.js 18 o superior.
- PostgreSQL accesible y una cadena `DATABASE_URL` válida.

### Configuración rápida
1) Copia el ejemplo de variables y ajusta tu conexión:
```bash
cp .env.example .env
```
2) Instala dependencias:
```bash
npm install
```
3) Genera el cliente de Prisma (por si cambiaste el esquema):
```bash
npx prisma generate
```
4) (Opcional) Crea las tablas en tu base:
```bash
npx prisma db push
```
5) Arranca en local:
```bash
npm run dev
```

### Qué incluye
- Creación y eliminación de proyectos con color automático.
- Temporizador Pomodoro con inicio/pausa/reanudación; al completar guarda la sesión
  en la base y la asigna al proyecto activo.
- Panel de proyectos con tiempo acumulado y conteo de sesiones.
- Calendario mensual que muestra minutos dedicados por día (heatmap suave).
- Lista de sesiones recientes del proyecto seleccionado.
- Autenticación propia (sin terceros) con email/contraseña cifrada con bcrypt,
  sesión en cookie HttpOnly y cierre de sesión desde la navbar.

### Personalización
- Ajusta la duración del ciclo (10 a 60 min) desde el control deslizante.
- Colores de proyectos configurables en `src/app/api/projects/route.ts`.
- Esquema Prisma en `prisma/schema.prisma` (Project y Session).

### Notas de base de datos
- El proveedor está configurado para PostgreSQL.
- Usa `npx prisma db push` para crear tablas en la base indicada por `DATABASE_URL`.
- Cliente Prisma generado en `src/generated/prisma` (ver `prisma.config.ts`).
