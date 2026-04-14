# Deploy Layout

This project separates stateful infrastructure from stateless application services.

## Structure

- `db/`: MySQL and persistent volume
- `app/`: backend and frontend services
- `.env`: shared environment values used by both stacks

Dockerfiles live with each app:

- `app/backend/Dockerfile`
- `app/frontend/Dockerfile`

## Environment files

Update `deploy/.env` before running.

- `deploy/.env`

## Development

Start the database stack first:

```bash
docker compose -f deploy/db/docker-compose.yml --env-file deploy/.env up -d
```

Then start the application stack:

```bash
docker compose -f deploy/app/docker-compose.yml --env-file deploy/.env up -d --build
```

Stop only the application stack:

```bash
docker compose -f deploy/app/docker-compose.yml --env-file deploy/.env down
```

Stop the database stack:

```bash
docker compose -f deploy/db/docker-compose.yml --env-file deploy/.env down
```

## Production

Initial deployment:

```bash
docker compose -f deploy/db/docker-compose.yml --env-file deploy/.env up -d
docker compose -f deploy/app/docker-compose.yml --env-file deploy/.env up -d --build
```

Application-only redeploy:

```bash
docker compose -f deploy/app/docker-compose.yml --env-file deploy/.env up -d --build
```

## Notes

- The database stack creates the shared Docker network. Bring it up first.
- The app stack expects MySQL to be reachable at host `mysql` on the shared network.
- Cross-compose startup ordering is not guaranteed, so the backend should tolerate DB warm-up and retry on startup if needed.
