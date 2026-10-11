# CompraLatino — Guía de despliegue en AWS (EC2 + Docker Compose)

Levanta todo el sistema (PostgreSQL 16 + backend Node/Express + frontend Vue con nginx) en **una sola instancia EC2**.
No cambia ni una línea del código de Fase 3: solo añade los archivos de Docker.

```
Internet ──80──▶ nginx (contenedor web) ──/api/──▶ backend (Node, :3000, interno)
                                                        │
                                                        ▼
                                           PostgreSQL 16 (interno, volumen persistente)
```

## 0. Costos estimados (verifica en la consola; son aproximados)

| Recurso | Costo aprox. |
|---|---|
| EC2 `t3.small` (2 GB RAM) | ~US$15/mes encendida |
| Disco EBS 20 GB | ~US$2/mes |
| IPv4 pública | ~US$3.6/mes |
| **Total** | **~US$20/mes** → los $100 alcanzan para ~5 meses, **si la apagas cuando no la uses** |

`t3.micro` (1 GB) es más barata pero justa para Postgres + Node + compilar el frontend. Si la consola no te deja elegir un tipo, es una restricción del plan gratuito: usa el que te permita.

## 1. Antes de crear nada

1. Consola AWS → arriba a la derecha elige la región **us-east-1 (N. Virginia)** (o la que prefieran, pero que sea la misma para todo el equipo).
2. Activa **MFA** en la cuenta raíz (IAM → Security credentials). No uses la cuenta raíz para el trabajo diario.
3. *Billing → Budgets → Create budget* (alerta, p. ej., a US$10). Cuenta además como actividad de "Explore AWS".

## 2. Crear la instancia EC2

*EC2 → Launch instance* (cuenta también como actividad de "Explore AWS"):

- **Name:** `compralatino`
- **AMI:** Ubuntu Server 24.04 LTS
- **Instance type:** `t3.small`
- **Key pair:** *Create new key pair* → tipo RSA, formato `.pem` → guárdalo (no se puede volver a descargar).
- **Network settings → Create security group**, con estas reglas de entrada:
  - SSH (22): origen **My IP** (solo tu IP)
  - HTTP (80): origen **Anywhere (0.0.0.0/0)**
  - **No abras el 5432 (Postgres) ni el 3000.**
- **Storage:** 20 GiB gp3.
- *Launch instance*. Cuando esté "Running", copia su **Public IPv4 address**.

> Si la apagas y la vuelves a encender, la IP pública cambia (a menos que le asignes una *Elastic IP*).

## 3. Subir el código

En tu PC (PowerShell), desde la carpeta `tareas\fase 3\`, sin `node_modules`:

```powershell
tar -czf compralatino.tgz --exclude=node_modules --exclude=dist --exclude=.env codigo
scp -i C:\ruta\a\tu-clave.pem compralatino.tgz ubuntu@IP_PUBLICA:~
ssh -i C:\ruta\a\tu-clave.pem ubuntu@IP_PUBLICA
```

(Alternativa: subir el código a un repositorio propio en GitHub y hacer `git clone` en la instancia.)

## 4. Instalar Docker en la instancia

Ya dentro de la instancia (por SSH):

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu && newgrp docker
```

## 5. Configurar y levantar

```bash
tar -xzf compralatino.tgz && cd codigo
cp .env.example .env
nano .env        # cambia DB_PASSWORD, JWT_SECRET y WEBHOOK_SECRET (genera con: openssl rand -hex 24)
docker compose up -d --build
docker compose ps                      # los 3 servicios deben estar "running"/"healthy"
docker compose exec backend npm run seed   # carga el catálogo y los usuarios de demostración (una sola vez)
```

La primera vez, Postgres ejecuta solo el `schema.sql` de Fase 2 y las 2 migraciones de Fase 3
(carpeta `deploy/db-init/`). Esos scripts **solo corren con el volumen vacío**.

## 6. Probar

Abre `http://IP_PUBLICA` en el navegador. La documentación interactiva de la
API también está disponible en `http://IP_PUBLICA/api/docs/`. Cuentas de
demostración (las mismas del README del código):

- Administrador: `admin@compralatino.com` / `Admin1234!`
- Cliente con compras: `laura.pineda@demo.compralatino.com` / `Demo1234!`

> Son contraseñas de demostración conocidas. Antes de dejar esto encendido mucho tiempo, cámbialas o apaga la instancia fuera de la defensa.
> Esta versión sirve por **HTTP** (sin dominio ni certificado), suficiente para la demo académica. Para HTTPS haría falta un dominio + Let's Encrypt.

## 7. Operación diaria

```bash
docker compose logs -f backend          # ver la bitácora del backend
docker compose restart backend          # reiniciar (p. ej. tras cambiar YAUCTIONS_FAILURE_RATE en .env)
docker compose down                     # detener (los datos se conservan en el volumen pgdata)
docker compose down -v                  # detener Y BORRAR la base de datos (para empezar de cero)
```

Demo del Circuit Breaker: en `.env` pon `YAUCTIONS_FAILURE_RATE=0.9` y `docker compose up -d` para recrear el backend.
El estado del circuito se ve en el panel de administración.

## 8. Cuidar los créditos

- Cuando no estés usando el sistema: *EC2 → Instance state → **Stop*** (no *Terminate*). Mientras esté detenida no paga cómputo, solo disco e IP.
- Al terminar el curso: *Terminate* la instancia y borra el volumen y la Elastic IP si creaste una.
- Revisa el saldo en *Billing and Cost Management → Credits*.
- El plan gratuito dura 6 meses desde que abriste la cuenta o hasta agotar los créditos; después AWS suspende la cuenta y conserva los datos 90 días.

## 9. Si algo falla

| Síntoma | Qué revisar |
|---|---|
| No abre `http://IP` | ¿Security group con el puerto 80 abierto a 0.0.0.0/0? ¿IP pública actual (cambia al reiniciar)? |
| `docker compose` no existe | Falta el paquete `docker-compose-v2` (paso 4). |
| `permission denied` con docker | Cierra y vuelve a abrir la sesión SSH (grupo `docker`), o usa `sudo`. |
| El backend no arranca | `docker compose logs backend`; casi siempre es un `.env` incompleto. |
| Se compila muy lento o falla por memoria | Usa `t3.small` en lugar de `t3.micro`. |
| Cambié el schema y no se aplica | Los scripts de `db-init` solo corren con el volumen vacío: `docker compose down -v` y vuelve a levantar (borra los datos). |
