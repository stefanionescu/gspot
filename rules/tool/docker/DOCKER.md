---
layer: tool
preset: docker
title: Docker
---

# Docker

## Core Docker philosophy

Rules:

- Docker images must be deterministic enough to debug and redeploy.
- Runtime images must be small, boring, and production-only.
- Build stages may contain compilers, package managers, and dev tooling; runtime stages never do.
- Containers run one foreground service process.
- Containers do not own durable application state.
- Orchestrators restart and replicate processes; app code handles graceful startup/shutdown.
- Docker is not a place to hide secrets, tests, source maps, local config, or dev convenience tools.

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

- Use explicit tags, never bare image names.
- Prefer a literal Node major/minor/variant for service Dockerfiles.
- Prefer Debian slim for production Node services.
- Use digest pinning only when the team has a refresh process.
- Full Debian/buildpack images are acceptable in build stages when native compilation or broad tooling is required.
- Distroless or package-manager-free runtime images are advanced options; use only if debugging, CA certs, native libraries, and operations needs are understood.

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

- `node:<version>` is broad and buildpack-based; useful for development or build stages, not default runtime.
- `node:lts` is convenient but floating; avoid for production Dockerfiles unless pinned by digest.
- `node:<version>-bookworm-slim` is the default recommendation for Node runtime images.
- `node:alpine` is smaller but musl-based. It may require `gcompat`, may break native modules, and musl builds have different support/scanner characteristics.
- `node:slim` without a version selects a floating line and is not deterministic enough.
- Production apps use supported LTS releases.
- Node Docker images differ by architecture; do not assume every variant exists on every architecture.
- Do not rely on a package manager bundled in the base image for production services; install the pinned one.

## Dockerfile structure

Rules:

- Use BuildKit syntax when using secrets or advanced mounts:
    - `# syntax=docker/dockerfile:<VERSION>`
- Keep instructions ordered from stable to volatile:
    - base image
    - OS packages
    - package manager install
    - dependency manifests
    - dependency install
    - source copy
    - build
    - runtime copy
- Order the file: parser directives, `ARG` values `FROM` needs, `FROM`, identity labels and
  non-secret build args, runtime `ENV`, system packages, runtime dependencies. Then source and
  script copies, artifact download and validation, runtime user, workdir, exposed ports, healthcheck
  and entrypoint.
- Put related operations in the same layer when they form one installation transaction; split
  unrelated operations when it improves cache reuse or review.
- Keep the final image contract obvious: workdir, exposed ports, environment, healthcheck, and
  entrypoint.
- Pin packages when the repository already pins that package family or when the package affects
  runtime compatibility. Use binary wheels for runtime dependencies.
- Keep system package installation separate from artifact downloads.
- Prefer `COPY` over `ADD`.
- Do not use remote `ADD`.
- If downloading binaries, pin versions and verify checksums/signatures.
- Follow the Bash rules for shell behavior inside `RUN` blocks. Move complex
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

- Use at least build/runtime stages for compiled Node/TypeScript services.
- Build stage may include compilers, source, source maps, and dev dependencies.
- Runtime stage gets only runtime dependencies and compiled artifacts.
- Build-time secrets must not cross into runtime stage.
- Do not copy the whole build context into runtime.
- Do not copy local `node_modules`.
- Native modules must be built for the runtime OS/libc/architecture.
- If build and runtime images differ, explicitly account for native module compatibility.

## Package installation

General rules:

- Install dependencies from lockfiles when available.
- For npm services: prefer `npm ci --omit=dev` or the approved npm production equivalent.
- For Bun services: use `bun install` in build stage and `bun install --production` in runtime stage.
- Use one package manager per service. Do not mix them in one image.
- Do not install global npm dependencies. If a service truly needs global npm tools, put global prefix under the non-root user home and document why.
- Do not rely on package-manager binaries in runtime unless the runtime actually invokes them.
- Removing npm/yarn from runtime is allowed as a hardening step only if the service does not need them and the Dockerfile remains maintainable.

## Bun and Node tooling

API-specific rules:

- Pin the Bun version in Dockerfiles and package metadata, and keep those values
  in sync.
- Install Bun the same way in build/runtime unless a dedicated base image is introduced.
- Do not replace Bun with npm examples from external docs.
- `NODE_ENV=production` belongs in runtime images and compose runtime env.
- Do not increase npm/Bun log verbosity in Dockerfiles unless debugging a requested build problem.

## Build cache

Rules:

- Copy dependency manifests before source.
- Do not place frequently changing labels, build numbers, timestamps, or generated files before dependency install.
- `.dockerignore` excludes logs, coverage, build outputs, caches, and local config that invalidate the cache.
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
- Every image stack has its own `.dockerignore`, reviewed with the Dockerfile that depends on it.
  Do not hide source, generated dependency exports, or scripts the Dockerfile needs, and do not use
  broad patterns that remove stack-owned scripts.

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
- Keep secret IDs descriptive but not secret-valued. Do not write secrets to intermediate files,
  shell traces, image labels, or generated READMEs. Do not add secret defaults. Do not log full
  environment dumps.

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
  messages.
- Health checks check the serving process or endpoint, not whether a shell started.
- Warmup is explicit. Do not hide warmup failures behind a successful container start.
- Signal handling allows graceful shutdown of the server process.
- Log enough runtime state to diagnose the selected mode, paths, port, and hardware configuration
  without printing secrets.
- Do not start multiple long-lived processes unless the script owns process supervision.
- Environment variables that configure the server are part of the runtime contract. Keep defaults in
  the owning config modules; do not duplicate a default across Dockerfile, shell, and application
  code unless it is part of the image contract.
- Prefer explicit `ENV` declarations for values the image owns. Keep the README environment table in
  sync with the Dockerfile.

## Users and file ownership

Rules:

- Runtime containers must not run as root.
- Use a stable app user.
- Ensure runtime files are readable by the app user.
- Prefer copying/chowning in a way that does not leave root-owned runtime state.
- Do not depend on writable application source directories.
- If using official `node` user, know it is uid 1000 and can be renamed/changed.
- If creating `appuser`, keep it system-scoped and non-login.

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

## Graceful shutdown

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
- Health/readiness probes must reflect that the service is stopping.
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

## Runtime environment

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
- Compose healthchecks hit lightweight liveness/readiness endpoints.
- Compose `depends_on` is startup ordering, not readiness unless health conditions are explicitly used.
- Do not mount source directories into production containers.
- Do not mount `node_modules` from host into production containers.
- Compose secrets come from environment or secret files ignored by git.
- Restart policy lets Docker/orchestrator restart failed processes.

## Memory and resource limits

Rules:

- Containers have memory limits in deployment/compose/orchestrator config.
- Node/V8 memory limits are aligned with container limits when memory ceilings matter.
- Leave headroom for non-V8 memory: native modules, buffers, TLS, compression, image/audio processing, Bun/package-manager work, and OS overhead.
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

## Security scanning

Rules:

- Every Dockerfile is linted before commit.
- Trivy scans the final runtime image in CI, not only source dependencies.
- Scanner findings require triage:
    - base image vulnerability
    - OS package vulnerability
    - Node runtime vulnerability
    - app dependency vulnerability
    - false positive / unreachable tool
- Prefer refreshed base images and dependency updates over ad hoc OS upgrades.
- Treat Docker lint and security findings as real until proven otherwise, and fix them directly.
  Keep a suppression narrow, naming the concrete false positive, or platform constraint. Never add a
  scanner baseline to avoid a real finding.
- Do not grant extra Linux capabilities by default, disable TLS verification, or download executable
  code without pinning and validation. Do not use world-writable directories outside a scoped
  runtime path. Do not add SSH keys, cloud credentials, local config files, or package-manager auth
  files.
- Docker READMEs document the current build and runtime contract: build args, environment variables,
  image tags, exposed ports, and artifact paths. Examples run from the repository root. They hold no
  real-looking secret values and no removed tools or history.
- Do not churn dependencies broadly without user approval.

## Image inspection

Rules:

- Inspect final images after Dockerfile changes.
- Check:
    - effective user is non-root
    - command is exec form/direct
    - no source maps in runtime
    - no tests/coverage/dev artifacts
    - no `.env`, `.npmrc`, or cloud credentials
    - no local `node_modules`
    - no package-manager caches
    - no unexpected shell/debug tools
    - expected env and labels only
- Useful commands:
    - `docker history <image>`
    - `docker image inspect <image>`
    - `docker run --rm <image> node --version`
    - `docker run --rm <image> sh -lc 'id && find /app -maxdepth 3 -type f | sort | head'`

## Anti-patterns

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
- package-manager caches in runtime image
- public debug/maintenance ports
- Compose production bind-mounting source directories
- Dockerfile changes that silently change Node major version

## Docker `RUN` blocks

Dockerfiles are not Bash scripts, but shell behavior inside `RUN` lines must
follow this guide when Bash is used.

Rules:

- Keep Docker `RUN` blocks short.
- Prefer `COPY`ing a reviewed script for complex install/build behavior.
- Use Bash as the Dockerfile `SHELL` only when Bash behavior is required.
- Do not add `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` just to make a
  Dockerfile look stricter.
- If a `RUN` pipeline matters, either use Bash with `pipefail` for that block or
  avoid the pipeline.
- Pin downloaded tool versions and verify checksums.
- Clean package-manager caches in the same layer.
- Do not leave installer scripts, secrets, package tokens, `.npmrc`, or local
  credentials in image layers.
- Do not use shell-form `CMD` or shell wrapper scripts as production container
  commands unless the wrapper is the documented process owner.

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

Before you run the checks of the repository, read the change against these questions:

- Does the change touch the correct image stack?
- Is shared behavior truly shared?
- Are build inputs explicit and validated before network or Docker work?
- Are dependency changes made in `pyproject.toml` and regenerated exports rather
- Are CUDA, PyTorch, TensorRT-LLM, vLLM, and FlashInfer compatibility constraints
- Are Hugging Face tokens and other secrets kept out of layers, logs, labels,
- Are model IDs, revisions required by Docker builds, engine labels, and
- Do runtime scripts follow Bash rules and use `exec` for final server handoff?
- Do Python helpers follow Python rules and avoid `sys.path` patching?
- Does each stack-local `.dockerignore` include necessary files and exclude
- Are Hadolint and security findings fixed directly instead of broadly ignored?
- Are Docker docs updated for changed build args, env vars, ports, paths, and
