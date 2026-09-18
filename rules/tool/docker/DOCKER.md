---
layer: tool
preset: docker
title: Docker
---

# Docker

## Core Docker philosophy

Rules:

- Docker images must be deterministic enough to debug and redeploy. `unenforced`
- Runtime images must be small, boring, and production-only. `unenforced`
- Build stages may contain compilers, package managers, and dev tooling; runtime stages never do. `enforced-by: docker/hadolint`
- Containers run one foreground service process. `unenforced`
- Containers do not own durable application state. `unenforced`
- Orchestrators restart and replicate processes; app code handles graceful startup/shutdown. `unenforced`
- Docker is not a place to hide secrets, tests, source maps, local config, or dev convenience tools. `unenforced`

```text
source files
  -> build stage
      -> install build tooling
      -> install dependencies
      -> compile
      -> upload/inject build artifacts with BuildKit secrets
  -> runtime stage
      -> production dependencies only
      -> compiled artifacts only
      -> non-root user
      -> exec-form process
      -> health/readiness probes
```

## Base image selection

Rules:

- Use explicit tags, never bare image names. `enforced-by: docker/hadolint`
- Prefer a literal Node major/minor/variant for service Dockerfiles. `unenforced`
- Prefer Debian slim for production Node services. `enforced-by: docker/hadolint`
- Use digest pinning only when the team has a refresh process. `enforced-by: docker/hadolint`
- Full Debian/buildpack images are acceptable in build stages when native compilation or broad tooling is required. `enforced-by: docker/hadolint`
- Distroless or package-manager-free runtime images are advanced options; use only if debugging, CA certs, native libraries, and operations needs are understood. `unenforced`

Bad:

```dockerfile
FROM node
FROM node:latest
FROM node:slim
FROM alpine
```

Good:

```dockerfile
FROM node:<MAJOR>-bookworm-slim
```

Digest example:

```dockerfile
FROM node:<MAJOR.MINOR.PATCH>-bookworm-slim@sha256:<DIGEST>
```

## Node.js image variants

Guidance:

- `node:<version>` is broad and buildpack-based; useful for development or build stages, not default runtime. `enforced-by: docker/hadolint`
- `node:lts` is convenient but floating; avoid for production Dockerfiles unless pinned by digest. `enforced-by: docker/hadolint`
- `node:<version>-bookworm-slim` is the default recommendation for Node runtime images. `unenforced`
- `node:alpine` is smaller but musl-based. It may require `gcompat`, may break native modules, and musl builds have different support/scanner characteristics. `enforced-by: docker/hadolint`
- `node:slim` without a version selects a floating line and is not deterministic enough. `enforced-by: docker/hadolint`
- Production apps use supported LTS releases. `enforced-by: docker/hadolint`
- Node Docker images differ by architecture; do not assume every variant exists on every architecture. `enforced-by: docker/hadolint`
- Do not rely on a package manager bundled in the base image for production services; install the pinned one. `unenforced`

## Dockerfile structure

Rules:

- Use BuildKit syntax when using secrets or advanced mounts:
    - `# syntax=docker/dockerfile:<VERSION>` `unenforced`
- Keep instructions ordered from stable to volatile:
    - base image `unenforced`
    - OS packages `unenforced`
    - package manager install `unenforced`
    - dependency manifests `unenforced`
    - dependency install `unenforced`
    - source copy `unenforced`
    - build `unenforced`
    - runtime copy `unenforced`
- Order the file: parser directives, `ARG` values `FROM` needs, `FROM`, identity labels and
  non-secret build args, runtime `ENV`, system packages, runtime dependencies. Then source and
  script copies, artifact download and validation, runtime user, workdir, exposed ports, healthcheck
  and entrypoint. `enforced-by: docker/hadolint`
- Put related operations in the same layer when they form one installation transaction; split
  unrelated operations when it improves cache reuse or review. `unenforced`
- Keep the final image contract obvious: workdir, exposed ports, environment, healthcheck, and
  entrypoint. `unenforced`
- Pin packages when the repository already pins that package family or when the package affects
  runtime compatibility. Use binary wheels for runtime dependencies. `unenforced`
- Keep system package installation separate from artifact downloads. `unenforced`
- Prefer `COPY` over `ADD`. `enforced-by: docker/hadolint`
- Do not use remote `ADD`. `enforced-by: docker/hadolint`
- If downloading binaries, pin versions and verify checksums/signatures. `enforced-by: docker/hadolint`
- Follow the Bash rules for shell behavior inside `RUN` blocks. Move complex
  shell logic into reviewed scripts instead of expanding Dockerfile inline
  commands. `enforced-by: docker/hadolint`
- Avoid full OS upgrades by default; use updated base images. Use targeted package upgrades only for documented vulnerability exceptions. `unenforced`
- Always clean apt lists in the same layer:
    - `rm -rf /var/lib/apt/lists/*` `unenforced`
- Install OS packages with `--no-install-recommends`. `enforced-by: docker/hadolint`
- Do not install debug/convenience tools in runtime images. `enforced-by: docker/hadolint`

Bad:

```dockerfile
FROM node
WORKDIR /usr/src/app
COPY . .
RUN npm install
CMD "npm" "start"
```

Good Node/Bun skeleton:

```dockerfile
# syntax=docker/dockerfile:<VERSION>

FROM node:<MAJOR>-bookworm-slim AS build
WORKDIR /app/api

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/install-bun.sh /tmp/install-bun.sh
RUN /tmp/install-bun.sh "<BUN_VERSION>" && rm -f /tmp/install-bun.sh
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json ./package.json
RUN bun install

COPY tsconfig.build.json ./tsconfig.build.json
COPY src ./src
RUN bunx tsc -p tsconfig.build.json && bunx tsc-alias -p tsconfig.build.json

FROM node:<MAJOR>-bookworm-slim AS runtime
WORKDIR /app/api

ENV NODE_ENV=production

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/install-bun.sh /tmp/install-bun.sh
RUN /tmp/install-bun.sh "<BUN_VERSION>" && rm -f /tmp/install-bun.sh
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json ./package.json
RUN bun install --production

COPY --from=build /app/api/dist ./dist

RUN groupadd -r appuser && useradd -r -g appuser appuser && chown -R appuser:appuser /app
USER appuser

CMD ["node", "dist/src/main.js"]
```

## Multi-stage builds

Rules:

- Use at least build/runtime stages for compiled Node/TypeScript services. `enforced-by: docker/hadolint`
- Build stage may include compilers, source, source maps, and dev dependencies. `enforced-by: docker/hadolint`
- Runtime stage gets only runtime dependencies and compiled artifacts. `enforced-by: docker/hadolint`
- Build-time secrets must not cross into runtime stage. `enforced-by: docker/hadolint`
- Do not copy the whole build context into runtime. `enforced-by: docker/hadolint`
- Do not copy local `node_modules`. `enforced-by: docker/hadolint`
- Native modules must be built for the runtime OS/libc/architecture. `enforced-by: docker/hadolint`
- If build and runtime images differ, explicitly account for native module compatibility. `unenforced`

## Package installation

General rules:

- Install dependencies from lockfiles when available. `enforced-by: docker/hadolint`
- For npm services: prefer `npm ci --omit=dev` or the approved npm production equivalent. `unenforced`
- For Bun services: use `bun install` in build stage and `bun install --production` in runtime stage. `enforced-by: docker/hadolint`
- Use one package manager per service. Do not mix them in one image. `enforced-by: docker/hadolint`
- Do not install global npm dependencies. If a service truly needs global npm tools, put global prefix under the non-root user home and document why. `enforced-by: docker/hadolint`
- Do not rely on package-manager binaries in runtime unless the runtime actually invokes them. `enforced-by: docker/hadolint`
- Removing npm/yarn from runtime is allowed as a hardening step only if the service does not need them and the Dockerfile remains maintainable. `enforced-by: docker/hadolint`

## Bun and Node tooling

API-specific rules:

- Pin the Bun version in Dockerfiles and package metadata, and keep those values
  in sync. `enforced-by: docker/hadolint`
- Install Bun the same way in build/runtime unless a dedicated base image is introduced. `enforced-by: docker/hadolint`
- Do not replace Bun with npm examples from external docs. `enforced-by: docker/hadolint`
- `NODE_ENV=production` belongs in runtime images and compose runtime env. `enforced-by: docker/hadolint`
- Do not increase npm/Bun log verbosity in Dockerfiles unless debugging a requested build problem. `enforced-by: docker/hadolint`

## Build cache

Rules:

- Copy dependency manifests before source. `enforced-by: docker/hadolint`
- Do not place frequently changing labels, build numbers, timestamps, or generated files before dependency install. `enforced-by: docker/hadolint`
- `.dockerignore` excludes logs, coverage, build outputs, caches, and local config that invalidate the cache. `enforced-by: docker/hadolint`
- Install OS packages before copying source when those packages change rarely. `enforced-by: docker/hadolint`
- Cache optimization must not weaken secrets handling or deterministic installs. `enforced-by: docker/hadolint`

Good ordering example:

```dockerfile
COPY package.json ./package.json
RUN bun install --production

COPY --from=build /app/api/dist ./dist
```

Bad ordering example:

```dockerfile
COPY . .
RUN bun install --production
```

## `.dockerignore`

Rules:

- Use deny-by-default. `enforced-by: docker/hadolint`
- Include only files the Dockerfile copies. `unenforced`
- Never include:
    - `.env` `enforced-by: docker/hadolint`
    - `.npmrc` `enforced-by: docker/hadolint`
    - `.git` `unenforced`
    - `node_modules` `unenforced`
    - `dist` `unenforced`
    - `coverage` `unenforced`
    - test reports `unenforced`
    - local cloud credentials `unenforced`
    - editor files `unenforced`
    - logs `unenforced`
    - source maps unless explicitly needed in a non-runtime build step `unenforced`
- `.dockerignore` protects both security and cache stability. `enforced-by: docker/hadolint`
- Every image stack has its own `.dockerignore`, reviewed with the Dockerfile that depends on it.
  Do not hide source, generated dependency exports, or scripts the Dockerfile needs, and do not use
  broad patterns that remove stack-owned scripts. `enforced-by: docker/hadolint`

Deny-by-default example:

```text
# Deny by default.
*

!.dockerignore
!Dockerfile
!package.json
!tsconfig.build.json
!src/
!src/**
```

## Secrets and BuildKit

Rules:

- Never pass secrets through `ARG`, `ENV`, committed config, `.env.example`, or Dockerfile literals. `enforced-by: docker/hadolint`
- Build args may be used for non-sensitive metadata only. `unenforced`
- Use BuildKit secrets for Sentry auth, npm registry tokens, private registry config, and build-time provider credentials. `enforced-by: docker/hadolint`
- Mounted secrets must be read only inside the specific `RUN --mount=type=secret` instruction. `enforced-by: docker/hadolint`
- Do not echo secrets. `enforced-by: docker/hadolint`
- Do not leave `.npmrc` or token-bearing config in layers. `enforced-by: docker/hadolint`
- Validate required build secrets with generic error messages that do not print secret values. `enforced-by: docker/hadolint`
- Keep secret IDs descriptive but not secret-valued. Do not write secrets to intermediate files,
  shell traces, image labels, or generated READMEs. Do not add secret defaults. Do not log full
  environment dumps. `unenforced`

Example:

```dockerfile
COPY scripts/upload-sourcemaps.sh /tmp/upload-sourcemaps.sh
RUN --mount=type=secret,id=sentry_auth_token \
    /tmp/upload-sourcemaps.sh /run/secrets/sentry_auth_token dist
```

Bad:

```dockerfile
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
```

## Entrypoints and health

Rules:

- Entrypoints validate configuration before starting the service and surface actionable failure
  messages. `unenforced`
- Health checks check the serving process or endpoint, not whether a shell started. `unenforced`
- Warmup is explicit. Do not hide warmup failures behind a successful container start. `unenforced`
- Signal handling allows graceful shutdown of the server process. `unenforced`
- Log enough runtime state to diagnose the selected mode, paths, port, and hardware configuration
  without printing secrets. `unenforced`
- Do not start multiple long-lived processes unless the script owns process supervision. `unenforced`
- Environment variables that configure the server are part of the runtime contract. Keep defaults in
  the owning config modules; do not duplicate a default across Dockerfile, shell, and application
  code unless it is part of the image contract. `enforced-by: docker/hadolint`
- Prefer explicit `ENV` declarations for values the image owns. Keep the README environment table in
  sync with the Dockerfile. `enforced-by: docker/hadolint`

## Users and file ownership

Rules:

- Runtime containers must not run as root. `enforced-by: docker/hadolint`
- Use a stable app user. `enforced-by: docker/hadolint`
- Ensure runtime files are readable by the app user. `enforced-by: docker/hadolint`
- Prefer copying/chowning in a way that does not leave root-owned runtime state. `enforced-by: docker/hadolint`
- Do not depend on writable application source directories. `enforced-by: docker/hadolint`
- If using official `node` user, know it is uid 1000 and can be renamed/changed. `enforced-by: docker/hadolint`
- If creating `appuser`, keep it system-scoped and non-login. `enforced-by: docker/hadolint`

Examples:

```dockerfile
RUN groupadd -r appuser && useradd -r -g appuser appuser && chown -R appuser:appuser /app
USER appuser
```

or:

```dockerfile
COPY --chown=node:node --from=build /build-stage/dist ./dist
USER node
```

## Process model and PID 1

Rules:

- Use exec-form `CMD`. `enforced-by: docker/hadolint`
- Do not use shell-form `CMD`. `enforced-by: docker/hadolint`
- Do not run package-script start commands, PM2, forever, nodemon, or shell wrapper scripts as production container commands. `enforced-by: docker/hadolint`
- Prefer direct app command:
    - `CMD ["node", "dist/src/main.js"]` `enforced-by: docker/hadolint`
- Node as PID 1 has signal/reaping caveats. If the service spawns child processes or signal behavior is not verified, use Docker `--init`, Tini, or dumb-init. `enforced-by: docker/hadolint`
- If adding an init wrapper to the image, use `ENTRYPOINT` for the init wrapper and keep `CMD` for the app command. `enforced-by: docker/hadolint`
- Do not add an init wrapper to solve missing application shutdown logic; app shutdown must still be implemented. `enforced-by: docker/hadolint`

Bad:

```dockerfile
CMD "node dist/src/main.js"
CMD ["npm", "start"]
CMD ["pm2-runtime", "dist/src/main.js"]
```

Good with init wrapper:

```dockerfile
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
```

## Graceful shutdown

Rules:

- App code must handle `SIGTERM` and `SIGINT`. `enforced-by: docker/hadolint`
- Shutdown sequence:
    - mark readiness false `enforced-by: docker/hadolint`
    - stop accepting new requests/work `unenforced`
    - drain in-flight requests for a bounded time `enforced-by: docker/hadolint`
    - close DB/provider/tool/WebSocket resources `unenforced`
    - clear runtime locks/timers where appropriate `unenforced`
    - log result `unenforced`
    - exit `unenforced`
- Health/readiness probes must reflect that the service is stopping. `enforced-by: docker/hadolint`
- Keep Docker stop timeout, orchestrator grace period, server keep-alive, and app shutdown timeout aligned. `enforced-by: docker/hadolint`
- Shutdown must be idempotent. `enforced-by: docker/hadolint`

```text
SIGTERM / SIGINT
  -> readiness false
  -> server stops accepting new connections
  -> in-flight work drains
  -> provider/db/tool resources close
  -> final telemetry/log flush
  -> process exits
```

## Runtime environment

Rules:

- Runtime config comes from env/secrets, not image rebuilds. `enforced-by: docker/hadolint`
- `NODE_ENV=production` must be set for production Node services. `enforced-by: docker/hadolint`
- Do not bake environment-specific secrets into images. `enforced-by: docker/hadolint`
- Do not put production secrets in compose examples. `enforced-by: docker/hadolint`
- Keep `.env.example` safe. `enforced-by: docker/hadolint`
- Expose only necessary ports. `enforced-by: docker/hadolint`
- Use health/readiness endpoints that are cheap and do not perform expensive provider checks. `enforced-by: docker/hadolint`

## Docker Compose

Rules:

- Compose owns local/deployment wiring, not application behavior. `enforced-by: docker/hadolint`
- Compose may set env, secrets, ports, restart policy, healthchecks, logging, cgroups, memory, and service dependencies. `enforced-by: docker/hadolint`
- Bind ports to localhost by default for local/private services. `enforced-by: docker/hadolint`
- Compose healthchecks hit lightweight liveness/readiness endpoints. `enforced-by: docker/hadolint`
- Compose `depends_on` is startup ordering, not readiness unless health conditions are explicitly used. `enforced-by: docker/hadolint`
- Do not mount source directories into production containers. `enforced-by: docker/hadolint`
- Do not mount `node_modules` from host into production containers. `unenforced`
- Compose secrets come from environment or secret files ignored by git. `enforced-by: docker/hadolint`
- Restart policy lets Docker/orchestrator restart failed processes. `enforced-by: docker/hadolint`

## Memory and resource limits

Rules:

- Containers have memory limits in deployment/compose/orchestrator config. `enforced-by: docker/hadolint`
- Node/V8 memory limits are aligned with container limits when memory ceilings matter. `enforced-by: docker/hadolint`
- Leave headroom for non-V8 memory: native modules, buffers, TLS, compression, image/audio processing, Bun/package-manager work, and OS overhead. `enforced-by: docker/hadolint`
- Do not treat memory limits as app performance fixes; measure and profile first. `enforced-by: docker/hadolint`
- Avoid unbounded in-memory transforms in services. `enforced-by: docker/hadolint`

Examples:

```yaml
services:
    api:
        mem_limit: 512m
```

Optional Node command form when needed:

```dockerfile
CMD ["node", "--max-old-space-size=384", "dist/src/main.js"]
```

## Security scanning

Rules:

- Hadolint lints every Dockerfile in the gate. `enforced-by: docker/hadolint`
- Trivy scans the final runtime image in CI, not only source dependencies. `enforced-by: docker/hadolint`
- Scanner findings require triage:
    - base image vulnerability `unenforced`
    - OS package vulnerability `unenforced`
    - Node runtime vulnerability `unenforced`
    - app dependency vulnerability `unenforced`
    - false positive / unreachable tool `unenforced`
- Prefer refreshed base images and dependency updates over ad hoc OS upgrades. `enforced-by: docker/hadolint`
- Treat Docker lint and security findings as real until proven otherwise, and fix them directly.
  Keep a suppression narrow, naming the concrete false positive, or platform constraint. Never add a
  scanner baseline to avoid a real finding. `unenforced`
- Do not grant extra Linux capabilities by default, disable TLS verification, or download executable
  code without pinning and validation. Do not use world-writable directories outside a scoped
  runtime path. Do not add SSH keys, cloud credentials, local config files, or package-manager auth
  files. `unenforced`
- Docker READMEs document the current build and runtime contract: build args, environment variables,
  image tags, exposed ports, and artifact paths. Examples run from the repository root. They hold no
  real-looking secret values and no removed tools or history. `unenforced`
- Do not churn dependencies broadly without user approval. `enforced-by: docker/hadolint`

## Image inspection

Rules:

- Inspect final images after Dockerfile changes. `enforced-by: docker/hadolint`
- Check:
    - effective user is non-root `enforced-by: docker/hadolint`
    - command is exec form/direct `unenforced`
    - no source maps in runtime `unenforced`
    - no tests/coverage/dev artifacts `unenforced`
    - no `.env`, `.npmrc`, or cloud credentials `enforced-by: docker/hadolint`
    - no local `node_modules` `enforced-by: docker/hadolint`
    - no package-manager caches `unenforced`
    - no unexpected shell/debug tools `unenforced`
    - expected env and labels only `unenforced`
- Useful commands:
    - `docker history <image>` `unenforced`
    - `docker image inspect <image>` `unenforced`
    - `docker run --rm <image> node --version` `unenforced`
    - `docker run --rm <image> sh -lc 'id && find /app -maxdepth 3 -type f | sort | head'` `unenforced`

## Anti-patterns

- `FROM node` `enforced-by: docker/hadolint`
- `FROM node:latest` `unenforced`
- `FROM node:alpine` without documented tradeoff `unenforced`
- `FROM node:slim` without a version `unenforced`
- `COPY . .` `unenforced`
- `RUN npm install` in production runtime `unenforced`
- copying host `node_modules` `unenforced`
- installing dev dependencies in runtime `unenforced`
- running as root `unenforced`
- `CMD "npm" "start"` `unenforced`
- `CMD ["npm", "start"]` `enforced-by: docker/hadolint`
- shell-form `CMD` `enforced-by: docker/hadolint`
- PM2/forever/nodemon in container `enforced-by: docker/hadolint`
- build secrets as `ARG` or `ENV` `enforced-by: docker/hadolint`
- `.npmrc` copied into build context `enforced-by: docker/hadolint`
- source maps shipped in runtime `unenforced`
- test files shipped in runtime `unenforced`
- full OS upgrade as routine build step `unenforced`
- remote `ADD` `enforced-by: docker/hadolint`
- unpinned binary downloads `unenforced`
- package-manager caches in runtime image `unenforced`
- public debug/maintenance ports `unenforced`
- Compose production bind-mounting source directories `unenforced`
- Dockerfile changes that silently change Node major version `unenforced`

## Docker `RUN` blocks

Dockerfiles are not Bash scripts, but shell behavior inside `RUN` lines must
follow this guide when Bash is used.

Rules:

- Keep Docker `RUN` blocks short. `enforced-by: docker/hadolint`
- Prefer `COPY`ing a reviewed script for complex install/build behavior. `enforced-by: docker/hadolint`
- Use Bash as the Dockerfile `SHELL` only when Bash behavior is required. `unenforced`
- Do not add `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` just to make a
  Dockerfile look stricter. `enforced-by: docker/hadolint`
- If a `RUN` pipeline matters, either use Bash with `pipefail` for that block or
  avoid the pipeline. `enforced-by: docker/hadolint`
- Pin downloaded tool versions and verify checksums. `enforced-by: docker/hadolint`
- Clean package-manager caches in the same layer. `enforced-by: docker/hadolint`
- Do not leave installer scripts, secrets, package tokens, `.npmrc`, or local
  credentials in image layers. `enforced-by: docker/hadolint`
- Do not use shell-form `CMD` or shell wrapper scripts as production container
  commands unless the wrapper is the documented process owner. `enforced-by: docker/hadolint`

Good short `RUN`:

```dockerfile
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*
```

For complex Docker install logic:

```dockerfile
COPY scripts/install_bootstrap.sh /tmp/install_bootstrap.sh
RUN bash /tmp/install_bootstrap.sh && rm -f /tmp/install_bootstrap.sh
```

The copied script must pass ShellCheck and follow this guide.

## Review checklist

Before `gspot check`, read the change against these questions:

- Does the change touch the correct image stack? `unenforced`
- Is shared behavior truly shared? `unenforced`
- Are build inputs explicit and validated before network or Docker work? `unenforced`
- Are dependency changes made in `pyproject.toml` and regenerated exports rather `unenforced`
- Are CUDA, PyTorch, TensorRT-LLM, vLLM, and FlashInfer compatibility constraints `unenforced`
- Are Hugging Face tokens and other secrets kept out of layers, logs, labels, `unenforced`
- Are model IDs, revisions required by Docker builds, engine labels, and `unenforced`
- Do runtime scripts follow Bash rules and use `exec` for final server handoff? `unenforced`
- Do Python helpers follow Python rules and avoid `sys.path` patching? `unenforced`
- Does each stack-local `.dockerignore` include necessary files and exclude `enforced-by: docker/hadolint`
- Are Hadolint and security findings fixed directly instead of broadly ignored? `enforced-by: docker/hadolint`
- Are Docker docs updated for changed build args, env vars, ports, paths, and `unenforced`
