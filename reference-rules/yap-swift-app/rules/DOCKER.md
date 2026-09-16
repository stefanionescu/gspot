# Working on Docker

These rules apply to Dockerfiles, `.dockerignore`, compose files, image build
scripts, container runtime behavior, and Docker-related CI checks across the
project.

Docker rules are not API-only. Application architecture rules stay in the
owning rule file; container packaging and runtime isolation rules live here.

## Contents

- [Core Docker Philosophy](#core-docker-philosophy)
- [Base Image Selection](#base-image-selection)
- [Node.js Image Variants](#nodejs-image-variants)
- [Dockerfile Structure](#dockerfile-structure)
- [Multi-Stage Builds](#multi-stage-builds)
- [Package Installation](#package-installation)
- [Bun and Node Tooling](#bun-and-node-tooling)
- [Build Cache](#build-cache)
- [`.dockerignore`](#dockerignore)
- [Secrets and BuildKit](#secrets-and-buildkit)
- [Users and File Ownership](#users-and-file-ownership)
- [Process Model and PID 1](#process-model-and-pid-1)
- [Graceful Shutdown](#graceful-shutdown)
- [Runtime Environment](#runtime-environment)
- [Docker Compose](#docker-compose)
- [nginx and Edge Containers](#nginx-and-edge-containers)
- [Memory and Resource Limits](#memory-and-resource-limits)
- [Security Scanning](#security-scanning)
- [Image Inspection](#image-inspection)
- [Anti-Patterns](#anti-patterns)

## Core Docker Philosophy

Rules:

- Docker images must be deterministic enough to debug and redeploy.
- Runtime images must be small, boring, and production-only.
- Build stages may contain compilers, package managers, and dev tooling; runtime stages should not.
- Containers run one foreground service process.
- Containers do not own durable application state.
- Orchestrators restart and replicate processes; app code handles graceful startup/shutdown.
- Docker is not a place to hide secrets, tests, source maps, local config, or dev convenience tools.
- Do not run Docker checks unless the user asks or CI owns them.

```text
source files
  -> build stage
      -> install build tooling
      -> install dependencies
      -> compile/test only when explicitly requested
      -> upload/inject build artifacts with BuildKit secrets
  -> runtime stage
      -> production dependencies only
      -> compiled artifacts only
      -> non-root user
      -> exec-form process
      -> health/readiness probes
```

## Base Image Selection

Rules:

- Use explicit tags, never bare image names.
- Prefer a literal Node major/minor/variant for service Dockerfiles.
- Prefer Debian slim for production Node services.
- Use digest pinning only when the team has a refresh process.
- Full Debian/buildpack images are acceptable in build stages when native compilation or broad tooling is required.
- Distroless or package-coordinator-free runtime images are advanced options; use only if debugging, CA certs, native libraries, and operations needs are understood.

Bad:

```dockerfile
FROM node
FROM node:latest
FROM node:slim
FROM alpine
```

Good:

```dockerfile
FROM node:20-bookworm-slim
FROM node:22-bookworm-slim
FROM node:24-bookworm-slim
```

Digest example:

```dockerfile
FROM node:22.16.0-bookworm-slim@sha256:<digest>
```

## Node.js Image Variants

Guidance:

- `node:<version>` is broad and buildpack-based; useful for development or build stages, not default runtime.
- `node:lts` is convenient but floating; avoid for production Dockerfiles unless pinned by digest.
- `node:<version>-bookworm-slim` is the default recommendation for Node runtime images.
- `node:alpine` is smaller but musl-based. It may require `gcompat`, may break native modules, and musl builds have different support/scanner characteristics.
- `node:slim` without a version selects a floating line and is not deterministic enough.
- Production apps should use supported LTS releases.
- Node Docker images differ by architecture; do not assume every variant exists on every architecture.
- Yarn v1 is bundled in Node images up to Node 25 and removed from Node 26; do not rely on bundled Yarn for production services.

## Dockerfile Structure

Rules:

- Use BuildKit syntax when using secrets or advanced mounts:
    - `# syntax=docker/dockerfile:1.7`
- Keep instructions ordered from stable to volatile:
    - base image
    - OS packages
    - package coordinator install
    - dependency manifests
    - dependency install
    - source copy
    - build
    - runtime copy
- Prefer `COPY` over `ADD`.
- Do not use remote `ADD`.
- If downloading binaries, pin versions and verify checksums/signatures.
- Follow `rules/BASH.md` for shell behavior inside `RUN` blocks. Move complex
  shell logic into reviewed scripts instead of expanding Dockerfile inline
  commands.
- Avoid full OS upgrades by default; use updated base images. Use targeted package upgrades only for documented vulnerability exceptions.
- Always clean apt lists in the same layer:
    - `rm -rf /var/lib/apt/lists/*`
- Install OS packages with `--no-install-recommends`.
- Do not install debug/convenience tools in runtime images.

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
# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS build
WORKDIR /app/api

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/install-bun.sh /tmp/install-bun.sh
RUN /tmp/install-bun.sh "bun-v1.3.11" && rm -f /tmp/install-bun.sh
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json ./package.json
RUN bun install

COPY tsconfig.build.json ./tsconfig.build.json
COPY src ./src
RUN bunx tsc -p tsconfig.build.json && bunx tsc-alias -p tsconfig.build.json

FROM node:20-bookworm-slim AS runtime
WORKDIR /app/api

ENV NODE_ENV=production

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/install-bun.sh /tmp/install-bun.sh
RUN /tmp/install-bun.sh "bun-v1.3.11" && rm -f /tmp/install-bun.sh
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json ./package.json
RUN bun install --production

COPY --from=build /app/api/dist ./dist

RUN groupadd -r appuser && useradd -r -g appuser appuser && chown -R appuser:appuser /app
USER appuser

CMD ["node", "dist/src/main.js"]
```

## Multi-Stage Builds

Rules:

- Use at least build/runtime stages for compiled Node/TypeScript services.
- Build stage may include compilers, source, source maps, and dev dependencies.
- Runtime stage gets only runtime dependencies and compiled artifacts.
- Build-time secrets must not cross into runtime stage.
- Do not copy the whole build context into runtime.
- Do not copy local `node_modules`.
- Native modules must be built for the runtime OS/libc/architecture.
- If build and runtime images differ, explicitly account for native module compatibility.

## Package Installation

General rules:

- Install dependencies from lockfiles when available.
- For npm services: prefer `npm ci --omit=dev` or the approved npm production equivalent.
- For Bun services: use `bun install` in build stage and `bun install --production` in runtime stage.
- Do not use npm/pnpm/yarn in `api/`.
- Do not install global npm dependencies. If a service truly needs global npm tools, put global prefix under the non-root user home and document why.
- Do not rely on package-coordinator binaries in runtime unless the runtime actually invokes them.
- Removing npm/yarn from runtime is allowed as a hardening step only if the service does not need them and the Dockerfile remains maintainable.

## Bun and Node Tooling

API-specific rules:

- Pin the Bun version in Dockerfiles and package metadata, and keep those values
  in sync.
- Install Bun the same way in build/runtime unless a dedicated base image is introduced.
- Do not replace Bun with npm examples from external docs.
- `NODE_ENV=production` belongs in runtime images and compose runtime env.
- Do not increase npm/Bun log verbosity in Dockerfiles unless debugging a requested build problem.

## Build Cache

Rules:

- Copy dependency manifests before source.
- Do not place frequently changing labels, build numbers, timestamps, or generated files before dependency install.
- `.dockerignore` should exclude logs, coverage, build outputs, caches, and local config that would invalidate cache.
- Install OS packages before copying source when those packages change rarely.
- Cache optimization must not weaken secrets handling or deterministic installs.

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

- Use deny-by-default.
- Include only files the Dockerfile copies.
- Never include:
    - `.env`
    - `.npmrc`
    - `.git`
    - `node_modules`
    - `dist`
    - `coverage`
    - test reports
    - local cloud credentials
    - editor files
    - logs
    - source maps unless explicitly needed in a non-runtime build step
- `.dockerignore` protects both security and cache stability.

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

- Never pass secrets through `ARG`, `ENV`, committed config, `.env.example`, or Dockerfile literals.
- Build args may be used for non-sensitive metadata only.
- Use BuildKit secrets for Sentry auth, npm registry tokens, private registry config, and build-time provider credentials.
- Mounted secrets must be read only inside the specific `RUN --mount=type=secret` instruction.
- Do not echo secrets.
- Do not leave `.npmrc` or token-bearing config in layers.
- Validate required build secrets with generic error messages that do not print secret values.

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

## Users and File Ownership

Rules:

- Runtime containers must not run as root.
- Use a stable app user.
- Ensure runtime files are readable by the app user.
- Prefer copying/chowning in a way that does not leave root-owned runtime state.
- Do not depend on writable application source directories.
- If using official `node` user, know it is uid 1000 and can be renamed/changed.
- If creating `appuser`, keep it system-scoped and non-login where possible.

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

## Process Model and PID 1

Rules:

- Use exec-form `CMD`.
- Do not use shell-form `CMD`.
- Do not run package-script start commands, PM2, forever, nodemon, or shell wrapper scripts as production container commands.
- Prefer direct app command:
    - `CMD ["node", "dist/src/main.js"]`
- Node as PID 1 has signal/reaping caveats. If the service spawns child processes or signal behavior is not verified, use Docker `--init`, Tini, or dumb-init.
- If adding an init wrapper to the image, use `ENTRYPOINT` for the init wrapper and keep `CMD` for the app command.
- Do not add an init wrapper to solve missing application shutdown logic; app shutdown must still be implemented.

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

## Graceful Shutdown

Rules:

- App code must handle `SIGTERM` and `SIGINT`.
- Shutdown sequence:
    - mark readiness false
    - stop accepting new requests/work
    - drain in-flight requests for a bounded time
    - close DB/provider/tool/WebSocket resources
    - clear runtime locks/timers where appropriate
    - log result
    - exit
- Health/readiness probes must reflect shutdown state.
- Keep Docker stop timeout, orchestrator grace period, server keep-alive, and app shutdown timeout aligned.
- Shutdown must be idempotent.

```text
SIGTERM / SIGINT
  -> readiness false
  -> server stops accepting new connections
  -> in-flight work drains
  -> provider/db/tool resources close
  -> final telemetry/log flush
  -> process exits
```

## Runtime Environment

Rules:

- Runtime config comes from env/secrets, not image rebuilds.
- `NODE_ENV=production` must be set for production Node services.
- Do not bake environment-specific secrets into images.
- Do not put production secrets in compose examples.
- Keep `.env.example` safe.
- Expose only necessary ports.
- Use health/readiness endpoints that are cheap and do not perform expensive provider checks.

## Docker Compose

Rules:

- Compose owns local/deployment wiring, not application behavior.
- Compose may set env, secrets, ports, restart policy, healthchecks, logging, cgroups, memory, and service dependencies.
- Bind ports to localhost by default for local/private services.
- Compose healthchecks should hit lightweight liveness/readiness endpoints.
- Compose `depends_on` is startup ordering, not readiness unless health conditions are explicitly used.
- Do not mount source directories into production containers.
- Do not mount `node_modules` from host into production containers.
- Compose secrets should come from environment or secret files ignored by git.
- Restart policy should let Docker/orchestrator restart failed processes.

## nginx and Edge Containers

Rules:

- nginx handles edge concerns: TLS, request body limits, compression, timeout policy, static ACME paths, broad rate limiting.
- Prefer nginx/reverse-proxy compression for high-traffic production. If nginx owns compression, do not also compress the same responses in Express unless the behavior is deliberately tested.
- nginx must not encode product authorization or feature behavior.
- nginx body limits must match application parser limits.
- Health/readiness endpoints may be private/internal if they are not meant for public traffic.
- Keep nginx image tags explicit. Avoid unpinned `nginx:alpine` for production if image reproducibility matters.

## Memory and Resource Limits

Rules:

- Containers should have memory limits in deployment/compose/orchestrator config.
- Node/V8 memory limits should be aligned with container limits when memory ceilings matter.
- Leave headroom for non-V8 memory: native modules, buffers, TLS, compression, image/audio processing, Bun/package-coordinator work, and OS overhead.
- Do not treat memory limits as app performance fixes; measure and profile first.
- Avoid unbounded in-memory transforms in services.

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

## Security Scanning

Rules:

- Use Hadolint for Dockerfile lint when requested.
- Use Trivy or configured scanners for image/dependency scans when requested or
  in CI.
- Scans should include the final runtime image, not only source dependencies.
- Do not run broad scans by default in normal docs/code changes.
- Scanner findings require triage:
    - base image vulnerability
    - OS package vulnerability
    - Node runtime vulnerability
    - app dependency vulnerability
    - false positive / unreachable tool
- Prefer refreshed base images and dependency updates over ad hoc OS upgrades.
- Do not churn dependencies broadly without user approval.

## Image Inspection

Rules:

- Inspect final images after Dockerfile changes when asked.
- Check:
    - effective user is non-root
    - command is exec form/direct
    - no source maps in runtime
    - no tests/coverage/dev artifacts
    - no `.env`, `.npmrc`, or cloud credentials
    - no local `node_modules`
    - no package-coordinator caches
    - no unexpected shell/debug tools
    - expected env and labels only
- Useful commands:
    - `docker history <image>`
    - `docker image inspect <image>`
    - `docker run --rm <image> node --version`
    - `docker run --rm <image> sh -lc 'id && find /app -maxdepth 3 -type f | sort | head'`
    - image inspection tools only when requested.

## Anti-Patterns

- `FROM node`
- `FROM node:latest`
- `FROM node:alpine` without documented tradeoff
- `FROM node:slim` without a version
- `COPY . .`
- `RUN npm install` in production runtime
- copying host `node_modules`
- installing dev dependencies in runtime
- running as root
- `CMD "npm" "start"`
- `CMD ["npm", "start"]`
- shell-form `CMD`
- PM2/forever/nodemon in container
- build secrets as `ARG` or `ENV`
- `.npmrc` copied into build context
- source maps shipped in runtime
- test files shipped in runtime
- full OS upgrade as routine build step
- remote `ADD`
- unpinned binary downloads
- package-coordinator caches in runtime image
- public debug/maintenance ports
- Compose production bind-mounting source directories
- Dockerfile changes that silently change Node major version
  | Check Node version | `docker run --rm <image> node --version` |
  | Check runtime files | `docker run --rm <image> find /app -maxdepth 4 -type f` |

Do not run Docker builds, Trivy, broad security scans, or image inspection by
default. Run them only when the user asks or CI owns them.
