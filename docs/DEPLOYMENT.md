# Deployment

The project runs on three free services. Any host with Node.js, a static site and MySQL 8 works the same way.

```
GitHub Pages (static files)  ->  Render (Express API)  ->  Aiven (MySQL 8)
```

## 1. Database on Aiven

1. Create an Aiven for MySQL service on the free plan.
2. Note the host, port, user, password and database name from the service page. Download the CA certificate.
3. Free services power off after inactivity. If the API cannot connect (`ENOTFOUND`), power the service on again from the Aiven console.

## 2. API on Render

1. Create a Web Service from the repository with the root directory set to `backend`.
2. Build command: `npm install`. Start command: `npm start`. `npm start` applies any new migrations before the server starts.
3. Set these environment variables:

| Variable | Value |
|---|---|
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME | From Aiven |
| DB_CA | The contents of the Aiven CA certificate (newlines may be written as `\n`). Alternatively commit it as `backend/db/ca.pem` |
| ADMIN_PASSWORD | Password for the `admin` account |
| ALLOWED_ORIGINS | Your GitHub Pages origin, for example `https://yourname.github.io` |

4. Create the admin account once, from a shell with the same variables set: `npm run seed`.
5. Optional demo data: `npm run seed:demo`. Do not load demo accounts into anything real, because they share a known password.
6. Check `https://your-service.onrender.com/api/health` and `/api/health/db`.

Render's free tier sleeps when idle, so the first request after a pause can take up to a minute. The landing page shows a notice while the API wakes.

## 3. Frontend on GitHub Pages

1. In the repository settings, publish Pages from the branch root.
2. In `core.js`, set the API address used outside localhost:

```js
const API_BASE = isLocal ? 'http://localhost:3000/api' : 'https://your-service.onrender.com/api';
```

3. In `backend/server.js` the origin `https://harinandhreddy0411.github.io` is allowed by default. For a different Pages address, set `ALLOWED_ORIGINS` as above.

## Checklist before sharing the link

- [ ] `ADMIN_PASSWORD` changed from the default
- [ ] `.env` and any certificate private keys are not committed
- [ ] `/api/health/db` returns `reachable`
- [ ] Signed in as admin and opened Alumni verification
