# Project

Overview

## Documentation

Technical and user documentation are located in the `docs/` folder. Spanish translations are available under `docs/es/`.

## Environment files

Copy the examples before starting the packages:

- `server/.env.example` to `server/.env` for the API, Prisma and the development MariaDB container.
- `client/.env.example` to `client/.env` for the Vite app.

Both examples contain placeholders only; never commit real credentials.

## Local development with Docker

The API runs on the host with hot reload; Docker only provides MariaDB.

```bash
cp server/.env.example server/.env
docker compose -f compose.dev.yaml up -d mariadb
npm run dev
```

Adminer is optional and only starts with the `tools` profile:

```bash
docker compose -f compose.dev.yaml --profile tools up -d adminer
# http://127.0.0.1:8080
```

Stop the services and remove the development database volume:

```bash
docker compose -f compose.dev.yaml down
docker compose -f compose.dev.yaml down -v
```

## Production

See `docs/deployment.md` for the production compose file, the GHCR pull-only
deployment and the Vercel SPA configuration.

## Author

**Fernando Rivera** — primary author and maintainer

- GitHub: https://github.com/Asterki
- Website: https://asterki.xyz
- Email: asterki.dev@proton.me

## License

See [License](./LICENSE)
