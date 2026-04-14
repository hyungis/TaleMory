# Deploy Compose Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a deployment layout that separates database infrastructure from application services under `deploy/`.

**Architecture:** Keep stateful infrastructure in `deploy/db` and stateless app services in `deploy/app`, joined by a shared Docker network and shared environment file. Use MySQL because the backend example configuration already expects MySQL environment variables.

**Tech Stack:** Docker Compose, MySQL 8, Spring Boot, React/Vite, Nginx

---

### Task 1: Add deploy structure and compose files

**Files:**
- Create: `deploy/db/docker-compose.yml`
- Create: `deploy/db/.env.db.example`
- Create: `deploy/app/docker-compose.yml`
- Create: `deploy/app/.env.app.example`
- Create: `deploy/shared/.env.common.example`
- Create: `deploy/README.md`

**Step 1: Create the db compose**

Write a MySQL-only compose file with a named volume, healthcheck, and a shared network.

**Step 2: Create the app compose**

Write a compose file for `backend` and `frontend` that joins the shared external network and reads common and app-specific env files.

**Step 3: Add example env files**

Add one common env file and separate db/app example env files to show how configuration should be split.

**Step 4: Document execution**

Write a short deploy README with dev and production command sequences.

### Task 2: Add build inputs for the app compose

**Files:**
- Create: `deploy/app/Dockerfile.backend`
- Create: `deploy/app/Dockerfile.frontend`

**Step 1: Add backend Dockerfile**

Use a Gradle build stage and a JRE runtime stage for the Spring Boot app.

**Step 2: Add frontend Dockerfile**

Use a Node build stage with `pnpm` and serve the built assets through Nginx.

### Task 3: Verify compose validity

**Files:**
- Verify: `deploy/db/docker-compose.yml`
- Verify: `deploy/app/docker-compose.yml`

**Step 1: Validate db compose**

Run `docker compose -f deploy/db/docker-compose.yml config` and confirm the file resolves.

**Step 2: Validate app compose**

Run `docker compose -f deploy/app/docker-compose.yml config` and confirm the file resolves.
