# Framework Presets

A framework preset is the only place architecture is permitted, and only the framework's own. The
test, applied to every statement a framework preset makes:

> Would the framework's own documentation, scaffolding tool or compiler produce this layout?

Yes means the preset owns it. No means it belongs in `rules/project/`, which the consumer owns. That
test is requirement R10, made operational.

## `framework:nextjs`

Requires `language:typescript`, `language:css`, `repository:configuration`.

The clearest case: `create-next-app` produces the App Router layout, so the layout is the
framework's and the preset enforces it.

| Check                         | Enforces                                                                                                                                                    | Why it is the framework's                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `next/route-files`            | Only `page`, `layout`, `route`, `loading`, `error`, `not-found`, `template`, `default` and `middleware` are special, and each has the required export shape | Next.js resolves routes by filename                                         |
| `next/server-boundary`        | A file importing `server-only` is never reachable from a `"use client"` module. A file importing `client-only` is never reachable from a server component.  | The React Server Components model                                           |
| `next/no-secret-in-client`    | No `process.env` read without a `NEXT_PUBLIC_` prefix inside a client component subtree                                                                     | The framework's own inlining rule                                           |
| `next/metadata`               | Every `page` exports `metadata` or `generateMetadata`                                                                                                       | Framework API                                                               |
| `next/dynamic-params`         | A dynamic segment's params are awaited in Next 15 and later                                                                                                 | Framework API change                                                        |
| `next/image-and-font`         | `next/image` over a bare `img`, `next/font` over a stylesheet link                                                                                          | Framework guidance with a measurable effect                                 |
| `next/eslint-config-next`     | The official rule set                                                                                                                                       |                                                                             |
| `next/build-typecheck`        | `next build` with `typescript.ignoreBuildErrors` forced false and `eslint.ignoreDuringBuilds` forced false                                                  | These two flags are how a Next.js repository silently disables its own gate |
| `next/i18n-completeness`      | Every message key used in source exists in every locale, and every key in a locale is used                                                                  | Via `repository:configuration`, driven by the detected i18n library                    |
| `next/no-config-lint-disable` | `next.config.*` does not disable lint or type checking                                                                                                      | Same reason as above                                                        |

What the preset does **not** say: where business logic lives, whether there is a service layer,
whether data access goes through a repository, what a component directory looks like beyond the
route files. `slopshop` has strong opinions on all of those (`CLEANUP.md` sections 8, 18, 19 and 23
are about exactly that), and they belong in `rules/project/`, which the team writes.

Rules: the framework layer `rules/framework/nextjs/NEXTJS.md`, plus the library files from `slopshop`
selected by dependency detection: `ZOD.md`, `DRIZZLE.md`, `TRPC.md`, `TANSTACKQUERY.md`,
`ZUSTAND.md`, `REACTHOOKFORM.md`, `I18N.md`. Each is installed only when the
dependency is present, which is the preset model applied to prose.

Deployment adapters (`@opennextjs/cloudflare`, `wrangler.jsonc`, `open-next.config.ts` in
`slopshop`) are a separate optional preset, `framework:nextjs-cloudflare`, because they are a
deployment choice rather than a framework fact.

## `database:postgres`

Requires `language:sql`.

**This preset exists so the Supabase preset does not have to be where the value lives.** Everything
below is Postgres, not Supabase, and it serves any Postgres project: raw SQL, Drizzle, Prisma, Neon,
RDS, or Supabase.

| Check                    | Enforces                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pg/rls-present`         | Every table in a declared schema has row-level security enabled and at least one policy, or appears in an exemption with a reason |
| `pg/grants-explicit`     | Explicit grants, with no reliance on default privileges                                                                           |
| `pg/definer-search-path` | Every `SECURITY DEFINER` function sets `search_path`                                                                              |
| `pg/migration-safety`    | `squawk`, scoped by `immutable_through`. `assume_in_transaction` is set from whether the migration runner wraps files.            |
| `pg/migration-order`     | Versions are monotonic, with no gap that indicates a rebase accident                                                              |
| `pg/migration-immutable` | Bytes match the commit that froze them                                                                                            |
| `pg/object-naming`       | Tables, columns, indexes, constraints, triggers and policies follow the naming policy                                             |
| `pg/index-covers-fk`     | Every foreign key has a supporting index                                                                                          |
| `pg/no-blocking-ddl`     | Concurrent index creation outside a transaction, and lock-taking statements guarded                                               |

Nine checks, none of which mentions Supabase. This is where a plain Postgres project gets almost
everything, and it is the answer to how the SQL work avoids being too niche: **the general work
lives in the general preset.** The same shape applies elsewhere: `library:drizzle` and
`framework:prisma` require `database:postgres` and add only what their own tooling dictates.

## `library:zod`

Requires `language:typescript`. Selected when `zod` is a dependency.

`eslint-plugin-zod`, which `slopshop` already runs with fourteen rules on:
`no-any-schema`, `no-coerce-boolean`, `no-empty-custom-schema`, `no-native-enum`,
`no-promise-schema`, `no-throw-in-refine`, `prefer-strict-object`,
`prefer-top-level-string-formats`, `require-brand-type-parameter` and the rest.
The rule file `rules/library/zod/ZOD.md` installs with it. A library preset is one
plugin and one rule file, and that is the whole shape.

## `platform:supabase`

Requires `database:postgres`, `language:typescript`, `repository:configuration`.

Deliberately thin. It holds only what the Supabase product surface dictates, and nothing a Postgres
project would also want.

| Check                       | Enforces                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migration-name`   | `<timestamp>_<snake_case_name>.sql`, which is the CLI's own filename contract                                                                                                                                        |
| `supabase/cli-transaction`  | Sets `assume_in_transaction = true` for `pg/migration-safety`, because the CLI wraps each file. A product fact, read once.                                                                                           |
| `supabase/types-fresh`      | `supabase gen types` output matches the tracked file                                                                                                                                                                 |
| `supabase/service-role-key` | The service-role key appears in no client-reachable module                                                                                                                                                           |
| `supabase/auth-uid`         | Policies that compare against `auth.uid()` do so in a way the planner can use an index for                                                                                                                           |
| `supabase/edge-deno`        | `deno lint` and `deno check` over every edge function, including `functions/config` and `functions/shared`, which the reference repository lints only transitively through the two functions that have a `deno.json` |
| `supabase/config-schema`    | `supabase/config.toml` validates, and every declared function directory exists                                                                                                                                       |
| `supabase/storage-policy`   | Every bucket referenced in code is declared in config, and has policies                                                                                                                                              |
| `supabase/seed-determinism` | Seed SQL is idempotent, so a reset is repeatable                                                                                                                                                                     |

Five checks. Everything else moved to `database:postgres`, which is the point: a Supabase project
selects both and gets fourteen checks, and a Neon project selects one and gets nine.

The immutability pressure the reference branch failed under now has exactly one outlet:
`[sql.migrations] immutable_through`, a single value in a tracked file. Moving it is a visible
commit. See [13-language-presets/sql.md](13-language-presets/sql.md).

Rules: the framework layer `rules/platform/supabase/SUPABASE.md`, derived from the reference
`rules/SUPABASE.md`, which at 450 lines is already the cleanest framework file in the corpus. Its
"Ground Rules", "Change Workflow", "Migration Immutability" and "Review Checklist" sections survive
nearly whole.

## The shared `http` package

Not a preset. `shared = ["http"]` in the manifests of `framework:express`, `framework:fastapi`
and `framework:nextjs`, because what an HTTP service owes its callers is not a fact about any one
framework, and Node is a runtime, not the thing these checks are about. It carries the seven checks
below and the blocks `rules/shared/http/HTTP-API.md` and `OPENAPI.md`.

This is the package that requirement R11 is about. The reference `rules/API.md` is 1,470 lines and
mostly describes one service's architecture. The preset keeps only what HTTP and the language force.

| Check                       | Enforces                                                                          | Generalises?                        |
| --------------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| `http/contract-exists`      | Every route has a declared request and response schema                            | Yes. Every HTTP service needs this. |
| `http/validate-at-boundary` | Every handler validates its input before use, through the declared validator      | Yes                                 |
| `http/one-error-shape`      | Every error response matches one declared shape                                   | Yes                                 |
| `http/no-internal-leak`     | No stack trace, no internal identifier, no database error text in a response body | Yes                                 |
| `http/status-semantics`     | Status codes match the declared method and outcome table                          | Yes                                 |
| `http/openapi-fresh`        | The generated OpenAPI document matches the code                                   | Yes, where a generator exists       |
| `http/route-coverage`       | Every declared route has at least one test that exercises it                      | Yes                                 |

What moves to the project layer, because it is one team's design and not HTTP's:

- The ownership map: which module owns which concept.
- The module boundary table and the layer names.
- The endpoint directory structure and the entry-point convention.
- The domain-logic layer, the service layer, the data-access layer.
- The provider-integration pattern.
- The configuration and environment loading design.
- The nginx and deployment topology.

Those belong in `rules/project/`, which the team writes and gspot never touches. The check that
enforces the boundaries is `[[structure.contracts]]`; the prose that explains them is the team's.

The package is deliberately framework-neutral: Express, Fastify, Hono and Elysia all satisfy it,
because none of the seven checks names a framework. A framework preset adds what the framework
itself dictates on top.

## `framework:express`

Requires `language:typescript`, `shared = ["http"]`. Selected when `express` is a dependency.

The shared `http` package holds what any HTTP service owes its callers. This preset holds
what Express itself dictates, taken from the Express half of the reference
`API.md`, which mentions Express seventeen times and no other server framework.

| Check | Enforces |
| --- | --- |
| `express/error-handler-arity` | The error handler has four parameters. Express recognises it by arity, and a three-parameter handler silently never runs. |
| `express/body-limit` | Every `express.json` and `express.urlencoded` sets `limit`, and a global parser is not the only one: a route that accepts a large body sets its own |
| `express/helmet` | `helmet` is mounted before any route |
| `express/rate-limit-on-auth` | Routes under the declared auth prefix carry a rate-limit middleware. The reference repository has this as a Semgrep rule. |
| `express/middleware-order` | Parsers and security middleware mount before routers; the error handler mounts last |
| `express/no-sync-in-handler` | No synchronous filesystem or crypto call inside a handler |
| `express/async-errors` | An async handler is wrapped or Express 5 is in use, so a rejected promise reaches the error handler |

Seven checks, all Express facts. The rule file `rules/framework/express/EXPRESS.md` is
the Express half of the reference `API.md`.

## `framework:fastapi`

Requires `language:python`.

| Check                          | Enforces                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `fastapi/router-composition`   | Routes registered through `APIRouter`, included once, with a declared prefix                  |
| `fastapi/depends-only`         | Dependencies injected through `Depends`, never through a module-level singleton               |
| `fastapi/pydantic-boundary`    | Request and response models are Pydantic models, never bare dicts                             |
| `fastapi/response-model`       | Every route declares `response_model` or a typed return                                       |
| `fastapi/lifespan`             | Startup and shutdown through the lifespan context manager, not the deprecated event handlers  |
| `fastapi/openapi-fresh`        | The exported schema matches the code                                                          |
| `fastapi/no-blocking-in-async` | No synchronous IO inside an `async def` route, detected through a declared blocking-call list |

`yap-text-inference` uses FastAPI across four dependency variants, and its
`[[tool.importlinter.contracts]]` block already encodes the boundaries it cares about. Those nine
contracts move to `[[structure.contracts]]` in `gspot.toml`, because they are that project's
architecture and not FastAPI's.

## `tool:docker`

### Claims

```text
Dockerfile, Dockerfile.*, *.dockerfile
docker-compose.yml, docker-compose.*.yml, compose.yml, compose.*.yml
.dockerignore
```

### Tools

| Kind            | Tool                                        | Notes                                                                             |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| style                 | `hadolint`                                  |                                                                                   |
| syntax (compose)      | `docker compose config --quiet`             | Interpolation, service references, volume and network resolution                  |
| schema (compose)      | `check-jsonschema` against the Compose spec | Runs without Docker, so it works when the daemon is down                          |
| image vulnerabilities | `trivy image`                               | Requires `build`                                                                      |
| filesystem and config | `trivy config`                              | Runs without a daemon: reads the Dockerfile and compose file for misconfiguration |
| secrets               | `trivy` plus gitleaks                       |                                                                                   |
| runtime config        | preset checks                                 | Below                                                                             |

### Preset checks

Derived from the reference `rules/DOCKER.md`, which is 527 lines and mostly enforceable:

| Check                              | Enforces                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker/pinned-base`               | Every `FROM` pins a digest or an exact tag, never `latest`                                                                                                                                                                                                                               |
| `docker/nonroot`                   | A `USER` directive exists and is not root in the final stage                                                                                                                                                                                                                             |
| `docker/pid1`                      | The entrypoint is `exec` form, or an init is declared                                                                                                                                                                                                                                    |
| `docker/no-secret-args`            | No `ARG` or `ENV` whose name matches a secret pattern; `--mount=type=secret` instead                                                                                                                                                                                                     |
| `docker/dockerignore-deny-default` | `.dockerignore` starts from deny-by-default, which the reference repository's file does                                                                                                                                                                                                  |
| `docker/build-context`             | No file the build context needs is excluded, and nothing the build does not need is included. The reference repository un-ignores `quality/package.json` because the lint package is a workspace member; under gspot the lint distribution is a dependency, so the exception disappears. |
| `docker/compose-image-match`       | Every image referenced in compose is either built by a Dockerfile in the repository or pinned                                                                                                                                                                                            |

### Docker availability

The preset's defining constraint: half its checks need a running daemon, and the reference
repository's response was to exit zero when the daemon is down. That happened during the audit run,
in both hooks, for both the nginx config check and the Trivy scan.

The preset's response:

| Check                      | Needs daemon | When the daemon is down   |
| -------------------------- | ------------ | ------------------------- |
| `docker/hadolint`          | no           | runs                      |
| `docker/compose-schema`    | no           | runs                      |
| `docker/trivy-config`      | no           | runs                      |
| `docker/dockerfile-policy` | no           | runs                      |
| `docker/compose-config`    | yes          | `skipped`, fails the gate |
| `docker/trivy-image`       | yes          | `skipped`, fails the gate |
| `docker/nginx-config`      | yes          | `skipped`, fails the gate |

The split is deliberate: as much as possible moves to the no-daemon column, so that a laptop without
Docker running still gets real coverage, and the remainder is loudly skipped rather than silently
passed. A developer who does not run Docker adds those four checks to `gspot.local.toml` and sees
the skip in every run report.

### The nginx check, rebuilt

The reference implementation is the design's canonical example of policy in the wrong place:

`js // quality/config/nginx.js NGINX_IMAGE = 'nginx:1.29.3-alpine'; // duplicates api/docker-compose.yml:81 API_HOST_ENTRY = 'api:127.0.0.1'; // exists because api/nginx.conf:64 upstreams to api:3000 (CERT_DAYS, CERT_KEY_BITS); // lint scaffolding, fine, but not configuration`

If either product file changes, the lint validates against the old image and the old host and nobody
notices.

The gspot version runs the validation through the compose service, so the image, the network alias
and the volumes come from the product definition:

```text
docker compose -f {project.compose_file} run --rm --no-deps \
  -v {certs}:/etc/nginx/ssl:ro {project.nginx_service} nginx -t
```

The image is never named. `project.compose_file` and `project.nginx_service` come from `gspot.toml`,
and the certificate arguments are inline in the check because they are scaffolding, not
configuration. Where compose cannot be used, the preset reads the image through a declared
`[[project.value]]` with a `yaml-path` extraction, which fails loudly when the path is absent.

### Required kinds

```text
Dockerfile*         syntax style spelling secrets
docker-compose*.yml format syntax schema style spelling secrets
.dockerignore       syntax spelling
```

No `structure`, no `naming`, no `prose`. Stated rather than implied.

## `framework:comfyui`

Requires `language:python`. Selected when the root `__init__.py` exports
`NODE_CLASS_MAPPINGS` or `pyproject.toml` has a `[tool.comfy]` table. Adds
`language:typescript` when `web/` holds TypeScript.

ComfyUI passes the framework test: it dictates the root `__init__.py` exports, the
`WEB_DIRECTORY` extension loading, `[tool.comfy]` for the registry, `.comfyignore`
for packaging, and `requirements.txt` as the install contract. The reference is
`comfyui-reactor-connector`: 323 Python files, 30 TypeScript, 54 JavaScript, 21
shell, 40 workflow files, a locale catalogue, and a 140-file bespoke `quality/`
that is the same stack as the other reference repositories plus ComfyUI checks.

| Check | Enforces |
| ----- | -------- |
| `comfyui/node-mappings` | The root `__init__.py` exports `NODE_CLASS_MAPPINGS` and `NODE_DISPLAY_NAME_MAPPINGS`, and every mapped class defines `INPUT_TYPES`, `RETURN_TYPES`, `FUNCTION` and `CATEGORY` |
| `comfyui/web-directory` | `WEB_DIRECTORY` is exported when `web/` exists, and points at it |
| `comfyui/registry-metadata` | `[tool.comfy]` carries `DisplayName` and `requires-comfyui`, validated by the registry's own validator where one exists and by schema otherwise |
| `comfyui/comfyignore` | Development-only directories are excluded from the package: `quality/`, `scripts/`, `.mise/`, and TypeScript sources when built output ships |
| `comfyui/requirements-generated` | `requirements.txt` is a generated file produced from `uv.lock`, declared with its producer and asserted fresh. ComfyUI and its manager install from it, so it must exist and match. |
| `comfyui/host-provided` | Packages the host provides (`torch`, `numpy`, `pillow`, `av`, `aiohttp`) are declared as host dependencies with a version range and never pinned in `requirements.txt`. The reference repository invented this as `[tool.reactor-comfy].host-dependencies`; the concept generalises to every plugin ecosystem with a host. |
| `comfyui/node-docs` | `web/docs/<NodeName>.md` exists for every mapped node. ComfyUI shows these in the interface. |
| `comfyui/workflows` | `workflows/*.json` parse with the graph shape (`nodes`, `links`, `version`), every node `type` resolves to this package or to ComfyUI core, and where workflows are generated they are declared with their producer and asserted fresh |
| `comfyui/built-frontend-fresh` | Shipped JavaScript under `web/` is a generated file produced from the TypeScript sources by the declared build, and matches them |
| `comfyui/frontend-types` | `@comfyorg/comfyui-frontend-types` is a dependency and `tsconfig` restricts `types` to it |
| `comfyui/locales` | The locale catalogue under `locales/` is complete per language and every key is used, through the shared message-catalogue check with a declared accessor |

What stays the consumer's: model metadata validation (`comfy/models/check` in the
reference tasks) is one project's manifest and becomes a `[[check]]` entry.

The mixed-language shape needs nothing new: one root scope selects
`language:python`, `language:typescript`, `language:javascript`, `language:bash`,
`language:css`, `language:markdown`, `repository:configuration` and
`framework:comfyui`. The 54 JavaScript files sit outside the `tsconfig` include
today and get no type checking; `language:javascript` with `--checkJs` covers
them.

## `tool:nginx`

Requires `tool:docker` when nginx runs in a container. Selected when an
`nginx.conf` or a `conf.d/` directory exists.

| Check | Enforces |
| ----- | -------- |
| `nginx/syntax` | `nginx -t`, run through the compose service so the image and the upstream come from the product definition and are never restated |
| `nginx/security` | `gixy`: alias traversal, unsafe regex, missing SSL verification, host header spoofing |

Two checks. The reference monorepo validates syntax and never security, and
restates the image tag in its lint configuration; both are the reasons this preset
exists.

## `tool:xcode`

Requires `language:swift`, `repository:configuration`. Selected when `*.xcodeproj` or
`*.xcworkspace` is tracked. Checks only; it installs no rule block, because an Xcode project is a
build system, not something an agent writes prose rules for.

Covered in detail in [13-language-presets/swift.md](13-language-presets/swift.md). The preset owns the
Xcode project, the asset catalogue, the entitlements, the string catalogues, the test plans and the
orphan-source diff.

What it explicitly does **not** own, against the reference `rules/IOS.md`:

| Reference section                                                                                      | Verdict                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Architecture Standard, Layers and Dependency Direction, MVVM                                           | the project layer. SwiftUI does not require MVVM, and Apple's own guidance does not use it.             |
| Domain Layer, Use Cases, Repositories, DTOs and Mapping                                                | the project layer                                                                                       |
| Dependency Injection, Scoped Factories                                                                 | the project layer. SwiftUI has `@Environment`, which the framework layer file covers.                   |
| Navigation and Coordinators                                                                            | the project layer. `NavigationStack` is the framework layer; a coordinator pattern on top of it is not. |
| Feature Organization                                                                                   | the project layer                                                                                       |
| SwiftUI Views, State Management                                                                        | the framework layer. `@State`, `@Observable`, `@Environment` and view identity are Apple's model.       |
| Swift Source Style, Naming, Programming Practices, Documentation Comments, Concurrency, Error Handling | the language layer, the language                                                                        |
| UIKit and Apple Framework Boundaries, UIKit Lists and Data Sources, Diffable Data Sources              | the framework layer under a separate `framework:uikit` file, because it is a different framework        |
| Accessibility, Testing                                                                                 | the framework layer, split between `SWIFTUI.md` and `SWIFT-TESTING.md`                              |

## `framework:swiftui` and `framework:uikit`

Require `language:swift`. Selected when a tracked Swift file imports `SwiftUI` or `UIKit`. Each
installs one rule block, `rules/framework/swiftui/SWIFTUI.md` or `rules/framework/uikit/UIKIT.md`,
and no checks of its own beyond what SwiftLint already runs under `language:swift`.

Roughly 600 of the 1,531 lines move to the project layer. That is the R11 split, measured.

## Test-runner presets

`tool:vitest`, `tool:pytest`, `tool:swift-testing`. Small, and worth being presets
because test conventions are runner facts.

| Preset                      | Owns                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tool:vitest`        | The `@`@vitest/eslint-plugin`-plugin` rule set including `expect-expect`, coverage thresholds wired to a task, `setupFiles` conventions, and the rule that a mock is reset between tests |
| `tool:pytest`        | The Ruff `PT` family, fixture scope policy, `conftest.py` placement, and coverage thresholds wired to a task                                                                             |
| `tool:swift-testing` | `@Test` and `#expect` over XCTest for new tests, snapshot test configuration coverage                                                                                                    |

Coverage thresholds deserve their own note. The reference repository defines 80 percent thresholds
in two files and they run only under `RUN_COVERAGE=1`, with no CI to set it. Under gspot a threshold
is a check in the graph with a stage, or it does not exist. The default stage is `check`, and the
baseline applies: the threshold can only rise.

## Framework detection and rules selection

A framework preset installs its the framework layer rules, and a library rule file installs only when
the library is a declared dependency:

```text
next in dependencies                  -> rules/framework/nextjs/NEXTJS.md
zod in dependencies                   -> rules/library/zod/ZOD.md
drizzle-orm in dependencies           -> rules/library/drizzle/DRIZZLE.md
@trpc/server in dependencies          -> rules/library/trpc/TRPC.md
@tanstack/react-query in dependencies -> rules/library/tanstack-query/TANSTACKQUERY.md
zustand in dependencies               -> rules/library/zustand/ZUSTAND.md
react-hook-form in dependencies       -> rules/library/react-hook-form/REACTHOOKFORM.md
next-intl, i18next, react-intl or
@formatjs/intl in dependencies        -> rules/shared/i18n/I18N.md  (library:next-intl)
```

Dropping the dependency removes the rule file on the next `gspot sync`, which is the property
no hand-maintained corpus has: `slopshop`'s `CLAUDE.md` table lists nine framework files, and
nothing checks that the repository still uses all nine.
