---
title: Docker
---

# Docker

## Image inputs

Select a base image that supports the application's runtime, target architecture, native libraries,
and certificate requirements. Tags can change, so pin a reviewed digest when the build requires
immutable input, and keep an update process for security fixes: a digest never patches itself.

Use a supported runtime release. For native modules, keep the build and runtime operating system,
libc, and architecture compatible. Alpine, Debian, and distroless images have different runtime
and operational requirements; no single variant fits every application.

## Build and runtime stages

Build-only compilers, test dependencies, and package caches stay out of the final image. It keeps
interpreted source, declared debug artifacts, and any other file the runtime reads.
Private source maps stay out of publicly served assets. When compilation or dependency preparation
needs tools the runtime does not, a multi-stage build copies only the runtime inputs into the final
stage. Host `node_modules` never enter a Linux image.

This npm example assumes a `build` task that writes `dist/main.js`, a committed lockfile, and
Node.js 24; a release build that requires immutable input pins the reviewed digest.

```dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

Use the package manager the project declares; for Bun, its pinned version with
`bun install --frozen-lockfile`, adding `--production` for runtime dependencies. The final image
holds a package-manager binary only when the runtime uses it. A statically linked `server` built
for the target platform needs no package manager or shell, only the certificates, time-zone data,
or other runtime files it reads.

```dockerfile
FROM scratch
COPY server /server
USER 65532:65532
ENTRYPOINT ["/server"]
```

## Package installation and downloads

hadolint reports unpinned images and packages, apt cleanup, `ADD` for local files, and shell-form
commands. The rest is review:

- Install application dependencies from the declared lockfile without updating it during the build.
- Refresh repository metadata and install packages in the same `RUN`, so cached metadata cannot
  select an unintended version.
- Refresh base images for operating-system fixes. A targeted package upgrade is an explicit
  dependency change, never an unbounded distribution upgrade in every build.
- Verify a downloaded executable's digest or signature before installing it.
- Remove installation-only files and caches in the layer that creates them.

### Dockerfile organization

<!-- level: all -->

Put stable build inputs before frequently changing application source when that improves cache
reuse. Move substantial shell behavior into its existing script owner. Keep the final image's user,
working directory, environment, and startup command easy to find. Do not add a wrapper script
for a command that can be expressed directly.

## Build context and ignore files

The context holds only the files the build needs, and `.dockerignore` changes with every
Dockerfile that uses it. A deny-by-default context suits a small, stable input set.

- Exclude credentials, local dependency installations, unrelated logs, editor state, caches, and
  test reports. `.git`, secret-bearing `.env` files, and registry authentication files stay out
  unless a reviewed build contract needs a safe input from them.
- Never exclude `dist`, generated dependency exports, or build scripts by name alone: a build that
  copies verified prebuilt output needs it. Every `COPY` source survives the ignore rules.

## Build secrets

Use BuildKit secret mounts for private registry authentication and other build credentials.
Read the secret only inside the `RUN` instruction that requires it. Do not place secrets in
`ARG`, `ENV`, labels, committed configuration, or copied authentication files.

Never print a secret or copy it from a mount into a layer: removing it in a later layer leaves it
in the earlier one.

## Shell and process behavior

Use the shell syntax actually selected for `RUN`; the default shell is not Bash. A required
entrypoint script validates configuration and uses `exec` for its final handoff. A documented
process supervisor forwards signals and reaps its children, and no init wrapper hides missing
shutdown behavior in the application.

A service stops new work on termination, drains current work for a bounded time, releases owned
resources, and exits. Its shutdown limit fits the orchestrator's grace period, and a repeated
signal does not corrupt cleanup.

## Runtime

- The application runs as a non-root user unless the workload requires a reviewed, scoped
  privilege. That user reads its runtime files, and the source and unrelated folders stay
  read-only.
- Durable state lives in explicit volumes or external storage. Environment-specific values arrive
  at runtime, and secrets stay out of images and example configuration. A production Node.js
  service sets `NODE_ENV=production` where the runtime expects it.
- Expose only the required ports, and bind private local services to localhost. Never add Linux
  capabilities, public debug ports, or disabled TLS verification to make a build or service work.
- Health and readiness checks inspect service state, not whether a shell started, and stay bounded
  and cheap. Readiness follows startup and shutdown, and an optional warmup never hides a failed
  required initialization.
- Resource limits fit the deployment and leave room for native memory, buffers, and runtime
  overhead beyond a language heap limit. Measure memory before changing a limit; a larger one never
  fixes an unbounded allocation.

## Compose

Compose declares the wiring: ports, volumes, secrets, resource limits, health checks, restart
policy, and dependencies. Behavior stays in the application. `depends_on` orders startup, with the
health condition when a service needs another one ready. A production container never bind-mounts
development source or host dependencies. Concurrent test environments stay isolated, and each stops
only its own services.

## Verification

Build and scan the final image when its inputs change. Each finding belongs to the base image, an
operating-system package, the runtime, or an application dependency. Inspect the image's user,
command, required files, permissions, and exposed ports, and check that no credentials, build
caches, or development artifacts remain. Exercise startup, readiness, and shutdown under the
deployment's signal and resource contract. Image documentation names the current build arguments,
supported platforms, runtime environment, and artifact paths.

## References

| Topic         | Primary source                                                                        |
| ------------- | ------------------------------------------------------------------------------------- |
| Builds        | [Docker build best practices](https://docs.docker.com/build/building/best-practices/) |
| Build secrets | [Secret mounts](https://docs.docker.com/reference/dockerfile/#run---mounttypesecret)  |
