# Relationship Management System (RMS)

Premium CRM for managing contacts, celebrations, campaigns, and outreach.

## Stack

- Frontend: static HTML, Bootstrap, vanilla JavaScript
- Backend: Node.js, Express
- Database: MongoDB through the Express backend
- Auth: JWT
- Storage: local uploads under `public/uploads/`

The browser never connects directly to MongoDB. It calls same-origin `/api/...`
routes served by Express.

## Local Run

Configure `.env` from `.env.example`, then:

```powershell
npm install
npm start
```

Open `http://localhost:3000`.

## Seed Data

Seed scripts read Mongo connection settings from `.env`.

If the Mongo user was created in the Mongo `admin` database, include
`authSource=admin` in `MONGODB_URI`:

```env
MONGODB_URI=mongodb://mongoadmin:strongpassword@localhost:27018/rms?authSource=admin
```

`rms` is the database where application data is stored. `authSource=admin` is
only the database used to authenticate the Mongo user.

Run the scripts in this order:

1. Create or reset the first admin user.

```powershell
npm run seed:admin -- --email admin@rms.com --password "change-this-password" --name "RMS Admin"
```

2. Preview the sample business-data import.

```powershell
npm run seed:sample -- --dry-run
```

3. Import sample business data.

```powershell
npm run seed:sample
```

The sample import skips demo users and imports only business data. It refuses
to import into non-empty business collections unless you explicitly replace
existing sample/business data:

```powershell
npm run seed:sample -- --replace
```

## Production Notes

RMS is Mongo-only. If `MONGODB_URI` is missing or Mongo is unreachable, startup
fails instead of falling back to local JSON data.

There is no public registration route. Seed the first admin user, then create
all other users from the admin settings page.

The RMS UI is static HTML served by the Express backend, so the production
deployment uses one long-running RMS application container. MongoDB remains the
existing shared VPS Mongo container.

## Docker Deployment

Build, save, upload, and deploy the image:

```powershell
.\scripts\build-save-upload-image.ps1 `
  -Tag rms-001 `
  -VpsHost 159.198.70.19 `
  -VpsUser deploy `
  -PublicBaseUrl https://rms.heliorsoft.com `
  -DeployAfterUpload
```

If the image was already uploaded and you only need to recreate the VPS
container:

```powershell
.\scripts\deploy-on-vps.ps1 `
  -Tag rms-001 `
  -VpsHost 159.198.70.19 `
  -VpsUser deploy `
  -PublicBaseUrl https://rms.heliorsoft.com `
  -Deploy
```

The compose file is intentionally separate from the shared VPS Caddy setup:
`deploy/docker-compose.rms.yml`.

Add the example in `deploy/Caddyfile.rms.example` to the existing VPS Caddyfile.

After first deployment, run the seed sequence on the VPS:

```bash
cd /opt/apps/rms
docker compose run --rm rms-app npm run seed:admin -- --email admin@rms.com --password "change-this-password" --name "RMS Admin"
docker compose run --rm rms-app npm run seed:sample -- --dry-run
docker compose run --rm rms-app npm run seed:sample
```

Make sure `/opt/apps/rms/.env` has real values for `MONGODB_URI` and
`JWT_SECRET` before running the app or seed command.

```bash
docker compose run --rm rms-app npm run seed:sample -- --replace
```
