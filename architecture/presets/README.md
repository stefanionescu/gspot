# Presets

One page per preset. Each page states what the preset detects and claims, the tools it pins, and the configuration it renders. It also lists the checks it runs with their stage, the settings it exposes, and the rule files it installs. The manifest format is in [../04-presets.md](../04-presets.md).

## Languages

| Preset     | Detects                   | Tools                                                             | Page                           |
| ---------- | ------------------------- | ----------------------------------------------------------------- | ------------------------------ |
| typescript | `.ts`, `tsconfig.json`    | tsc, ESLint with typescript-eslint and @gspot/eslint-plugin, knip | [typescript.md](typescript.md) |
| javascript | `.js`, `node` shebang     | ESLint, `checkJs`, knip                                           | [javascript.md](javascript.md) |
| python     | `.py`, `pyproject.toml`   | Ruff, basedpyright, import-linter, pydoclint, deptry, vulture     | [python.md](python.md)         |
| swift      | `.swift`, `Package.swift` | SwiftLint, SwiftFormat, Periphery, xcodebuild                     | [swift.md](swift.md)           |
| bash       | `.sh`, shell shebang      | ShellCheck, shfmt, `bash -n`, the shell analyses                  | [bash.md](bash.md)             |
| sql        | `.sql`                    | sqlfluff, libpg-query                                             | [sql.md](sql.md)               |
| css        | `.css`                    | stylelint, Prettier                                               | [css.md](css.md)               |
| html       | `.html`                   | html-validate, Prettier, the HTML analyses                        | [html.md](html.md)             |
| markdown   | `.md`                     | markdownlint-cli2, Prettier, lychee                               | [markdown.md](markdown.md)     |

## Frameworks, platforms, databases

| Preset     | Detects                  | Adds                                                                                                             | Page                           |
| ---------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| nextjs     | `next`                   | eslint-config-next, boundaries, server-only, client environment, route segments, next config, CSS usage, locales | [nextjs.md](nextjs.md)         |
| express    | `express`                | Semgrep API pack, OpenAPI lint and freshness, route tests                                                        | [express.md](express.md)       |
| fastapi    | `fastapi`                | Ruff FAST, OpenAPI freshness, blocking IO in async                                                               | [fastapi.md](fastapi.md)       |
| supabase   | `supabase/config.toml`   | Deno lint, migration names, types freshness, storage policies, service-role containment, Semgrep pack            | [supabase.md](supabase.md)     |
| postgres   | Postgres SQL             | squawk, migration docs, immutability, RLS, grants, search path, foreign-key indexes                              | [postgres.md](postgres.md)     |
| cloudflare | `wrangler.*`, `_headers` | config schemas, headers and redirects syntax, security headers, env types                                        | [cloudflare.md](cloudflare.md) |

## Tools

| Preset  | Detects                           | Adds                                                                                     | Page                     |
| ------- | --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ |
| docker  | `Dockerfile`, compose             | hadolint, compose config, trivy                                                          | [docker.md](docker.md)   |
| nginx   | `nginx.conf`                      | gixy, `nginx -t` in the nginx image                                                      | [nginx.md](nginx.md)     |
| ansible | `ansible.cfg`                     | ansible-lint                                                                             | [ansible.md](ansible.md) |
| xcode   | `*.xcodeproj`                     | plist, xcconfig, xcstrings, asset catalogues, test plans, orphan sources, entitlements   | [xcode.md](xcode.md)     |
| vitest  | `vitest`                          | the vitest ESLint rules, coverage threshold, test support placement                      | [vitest.md](vitest.md)   |
| pytest  | `pytest`                          | Ruff PT, coverage threshold                                                              | [pytest.md](pytest.md)   |
| xctest  | `import XCTest`, `import Testing` | disabled tests with reasons, no sleeps, no recording mode, snapshot references, coverage | [xctest.md](xctest.md)   |

## Libraries

| Preset          | Detects                 | Adds                                                                | Page                                     |
| --------------- | ----------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| zod             | `zod`                   | eslint-plugin-zod, 13 rules                                         | [zod.md](zod.md)                         |
| drizzle         | `drizzle-orm`           | eslint-plugin-drizzle, raw SQL ban, migrations freshness, relations | [drizzle.md](drizzle.md)                 |
| trpc            | `@trpc/server`          | input schemas, router boundaries                                    | [trpc.md](trpc.md)                       |
| tanstack-query  | `@tanstack/react-query` | the query ESLint plugin                                             | [tanstack-query.md](tanstack-query.md)   |
| zustand         | `zustand`               | store shape selectors                                               | [zustand.md](zustand.md)                 |
| react-hook-form | `react-hook-form`       | resolver and submit selectors                                       | [react-hook-form.md](react-hook-form.md) |
| i18n            | `next-intl`, `i18next`  | `no-literal-string`, locale catalogs                                | [i18n.md](i18n.md)                       |

## Repository

| Preset       | Default              | Does                                                                              | Page                               |
| ------------ | -------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| structure    | with any language    | the structural rules across every language                                        | [structure.md](structure.md)       |
| naming       | with any language    | the naming engine                                                                 | [naming.md](naming.md)             |
| formatting   | with any language    | one `[format]` block for every formatter                                          | [formatting.md](formatting.md)     |
| spelling     | always               | typos                                                                             | [spelling.md](spelling.md)         |
| docs         | always               | links, anchors, headings, stale paths, agent files                                | [docs.md](docs.md)                 |
| commits      | always               | commitlint                                                                        | [commits.md](commits.md)           |
| secrets      | always               | gitleaks, trufflehog, env files                                                   | [secrets.md](secrets.md)           |
| dependencies | with any manifest    | osv, syncpack, lockfiles, manifest policy, install policy, ownership, large files | [dependencies.md](dependencies.md) |
| licenses     | with any manifest    | allowlists per ecosystem                                                          | [licenses.md](licenses.md)         |
| config-files | always               | JSON, YAML, TOML, env, plist, XML: format, syntax, schema                         | [config-files.md](config-files.md) |
| security     | proposed             | Semgrep, CodeQL                                                                   | [security.md](security.md)         |
| duplication  | proposed             | jscpd                                                                             | [duplication.md](duplication.md)   |
| prose        | proposed             | Vale over comments and documentation                                              | [prose.md](prose.md)               |
| static-site  | `.html` with a build | built-output checks: links, dead CSS and assets, size, sitemap, reproducibility   | [static-site.md](static-site.md)   |

"Default" presets are selected by `init` in every repository. "Proposed" presets are offered
and selected on a yes.

## Reference shapes

| Repository shape                               | Selection                                                                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python API in Docker with shell scripts        | python, fastapi, pytest, bash, docker, config-files, markdown, and the defaults                                                                                                           |
| Express API, Supabase, iOS app in one monorepo | scope `api`: typescript, express, docker, nginx, vitest; scope `supabase`: typescript, sql, postgres, supabase; scope `ios`: swift, xcode, xctest; root: bash, markdown, and the defaults |
| Static site on Cloudflare Pages                | javascript, html, css, static-site, cloudflare, bash, markdown, and the defaults                                                                                                          |
| Next.js app on Cloudflare                      | typescript, nextjs, cloudflare, css, vitest, zod, drizzle, trpc, tanstack-query, zustand, react-hook-form, i18n, bash, markdown, and the defaults                                         |
