---
title: Docker
---

# Docker

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Image inputs

Select a base image that supports the application's runtime, target architecture, native libraries,
and certificate requirements. Use an explicit version tag or reviewed digest. Do not use `latest`
or an unversioned image reference.

Tags can change. Pin a reviewed digest when the build requires immutable image input, and keep
an update process for security fixes. A digest does not keep an image patched automatically.
See [Docker's build guidance](https://docs.docker.com/build/building/best-practices/).

Use a supported runtime release. For native modules, keep the build and runtime operating system,
libc, and architecture compatible. Alpine, Debian, and distroless images have different runtime
and operational requirements; no single variant fits every application.

## Build and runtime stages

Keep build-only compilers, test dependencies, and package caches out of the final application
image. Preserve files the runtime actually needs. These can include interpreted source and declared
debug artifacts. Keep private source maps out of publicly served assets.

Use multi-stage builds when compilation or dependency preparation requires tools the runtime
does not need. Copy only the resulting runtime inputs into the final stage. Never copy host
`node_modules` into a Linux image.

This npm example assumes the project declares a `build` task that writes `dist/main.js`, commits
its lockfile, and runs on Node.js 24. The version tag illustrates the stages; release builds that
require immutable input pin the reviewed image digest.

Good:

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

Use the package manager already declared by the project. For Bun, preserve its pinned version
and run `bun install --frozen-lockfile`; include `--production` for runtime dependencies.
Include a package-manager binary in the final image only when the runtime uses it.

A statically linked executable can use a smaller runtime with no package manager or shell.
This example requires an executable `server` built for the target platform. Include certificates,
time-zone data, or other runtime files if the executable needs them.

Good:

```dockerfile
FROM scratch
COPY server /server
USER 65532:65532
ENTRYPOINT ["/server"]
```

## Package installation and downloads

- Install application dependencies from the declared lockfile without updating it during the build.
- Pin system package versions selected for the image. Keep repository metadata and installation
  in the same transaction so cached metadata cannot select an unintended version.
- With apt, use `--no-install-recommends` and remove `/var/lib/apt/lists/*` in the installation layer.
- Refresh base images for operating-system fixes. Review targeted package upgrades as explicit
  dependency changes instead of performing an unbounded distribution upgrade in every build.
- Pin downloaded executable versions and verify their digest or signature before installation.
- Keep credentials out of command arguments, shell traces, downloaded archives, and image history.
- Remove installation-only files and caches in the layer that creates them.

### Dockerfile organization

<!-- level: all -->

Put stable build inputs before frequently changing application source when that improves cache
reuse. Keep related installation commands in one transaction. Prefer `COPY` for local files;
use `ADD` only when its extraction or download semantics are required and reviewed.

Move substantial shell behavior into its existing script owner. Keep the final image's user,
working directory, environment, and startup command easy to find. Do not add a wrapper script
for a command that can be expressed directly.

## Build context and ignore files

Include only the files the build needs. Review `.dockerignore` with every Dockerfile that uses
its context. A deny-by-default context is useful when the allowed input set is small and stable.

Exclude credentials, local dependency installations, unrelated logs, editor state, caches, and
test reports. Keep `.git`, secret-bearing `.env` files, and registry authentication files out
unless a specific, reviewed build contract requires a safe input from them.

Do not exclude `dist`, generated dependency exports, or build scripts merely because of their
names. A build that copies verified prebuilt output needs that output in its context. Confirm
that every `COPY` source remains available after ignore rules apply.

## Build secrets

Use BuildKit secret mounts for private registry authentication and other build credentials.
Read the secret only inside the `RUN` instruction that requires it. Do not place secrets in
`ARG`, `ENV`, labels, committed configuration, or copied authentication files.

Avoid printing secrets or copying them from a mount into an image layer. Removing a secret in
a later layer does not remove it from earlier layers. Use generic missing-secret messages and
keep identifiers descriptive without including their values.

See [Docker's secret-mount reference](https://docs.docker.com/reference/dockerfile/#run---mounttypesecret).

## Shell and process behavior

Use the shell syntax actually selected for `RUN`. Do not assume the default shell is Bash.
If a pipeline must propagate intermediate failures, use a shell with the required `pipefail`
support or express the operations without a pipeline. Run ShellCheck on owned shell scripts.

Use exec-form `CMD` or `ENTRYPOINT` for the application process. A required entrypoint script
validates configuration and uses `exec` for its final handoff. A documented process supervisor
must forward signals and reap its children. Do not use an init wrapper to conceal missing
application shutdown behavior.

Keep foreground process ownership explicit. For services, handle termination by stopping new
work, draining current work for a bounded time, releasing owned resources, and exiting.
Align application shutdown limits with the orchestrator's grace period. Repeated shutdown
signals must not corrupt cleanup.

## Runtime permissions and configuration

Run the application as a non-root user unless the declared workload requires a reviewed,
scoped privilege. Give that user access to the required runtime files without making the
application source or unrelated directories writable.

Use explicit volumes or external storage for durable state. Configure environment-specific
values at runtime, and keep secrets out of images and example configuration. For production
Node.js services, set `NODE_ENV=production` where the runtime expects it.

Expose only required ports. Keep private local services bound to localhost. Do not add Linux
capabilities, public debug ports, or disabled TLS verification to make a build or service work.

## Health and resource limits

Health and readiness checks inspect the service state, not whether a shell started. Keep probes
bounded and inexpensive. Readiness must reflect startup and shutdown transitions. An optional
warmup must not conceal a failed required initialization.

Declare resource limits appropriate to the deployment. Leave room for native memory, buffers,
and runtime overhead when setting language-specific heap limits. Measure memory behavior before
changing limits; a larger limit does not correct an unbounded allocation.

## Compose and deployment

Compose declares service wiring, including ports, volumes, secrets, resource limits, health
checks, restart policy, and dependencies. Keep application behavior in the application.

`depends_on` provides ordering; use the required health condition when startup depends on another
service being ready. Do not bind-mount development source or host dependencies into a production
container. Preserve isolation between concurrent test environments and stop only owned services.

## Verification

Lint Dockerfiles and check Compose configuration with the selected project tools. Build and scan
the final runtime image when changing its inputs. Classify findings by their actual owner: base
image, operating-system package, runtime, or application dependency. Keep any verified false-positive
exception narrow and reasoned.

Inspect the image's user, command, required files, permissions, and exposed ports. Check that no
credentials, build caches, or unrelated development artifacts remain. Exercise startup, readiness,
and shutdown under the deployment's signal and resource contract.

Keep image documentation consistent with the current build arguments, supported platforms,
runtime environment, and artifact paths. Do not broaden dependency changes beyond the authorized
build work.
