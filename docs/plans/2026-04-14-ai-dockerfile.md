# AI Dockerfile Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a simple Docker build for the `app/ai` FastAPI service.

**Architecture:** Use a single-stage Python runtime image that installs dependencies from `requirements.txt`, copies the service source, and starts Uvicorn on port `8000`. Add a `.dockerignore` to keep the build context small and avoid copying local virtualenv files.

**Tech Stack:** Docker, Python, FastAPI, Uvicorn

---

### Task 1: Add container build files

**Files:**
- Create: `app/ai/Dockerfile`
- Create: `app/ai/.dockerignore`
- Modify: `app/ai/README.md`

**Step 1: Add Dockerfile**

Create a minimal Dockerfile for the FastAPI app.

**Step 2: Add .dockerignore**

Ignore `.venv`, caches, and bytecode files from the Docker build context.

**Step 3: Document Docker workflow**

Add build and run commands to the AI README.
