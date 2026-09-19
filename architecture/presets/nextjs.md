# `nextjs`

Kind: framework. Requires: typescript, react. Recommends: css, config-files.

## Detects and claims

|                         |                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detect                  | `next` in dependencies; `next.config.{js,mjs,ts}`                                                                                                                        |
| Claims                  | `app/**`, `pages/**`, `src/app/**`, `src/pages/**`, `middleware.{js,ts}`, `proxy.{js,ts}`, `next.config.*`, `next-env.d.ts` (generated), `public/**` (binary and static) |
| Architecture it assumes | the App Router layout, because `create-next-app` produces it; nothing else                                                                                               |

## Tools

eslint-config-next, @eslint/compat, eslint-plugin-react-hooks (through next), eslint-plugin-i18next,
@formatjs/icu-messageformat-parser (inside gspot), postcss-modules (inside gspot).

## Generated configuration

The typescript flat config gains, in order:

- the `core-web-vitals` set of `@next/eslint-plugin-next`, on ESLint 9 (D-142);
- the `[architecture]` boundaries (route, feature, shared);
- `gspot/require-server-only` over server files and `gspot/no-client-environment` over every file;
- the React rules come from the `react` preset, which this one requires; `@next/next/no-async-client-component`;
- the rules under "Turned off" below, rendered from the manifest (D-138).

Server files: `**/server/**`, `**/*.server.*`, `features/*/server/**`, `lib/**/server.*`, and any
file with `'use server'`. Client files: any file with `'use client'`.

## Turned off

| Rule                                                                                                   | Files                                                                                                                              | Why                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `structure/single-file-folder`, `gspot/no-trivial-files`, `gspot/no-export-only-files`, `no-reexports` | `page`, `layout`, `template`, `default`, `loading`, `error`, `not-found`, `global-error`, `route`, `middleware`, and `proxy` files | the framework finds these files by name, so a folder holds one and the file holds one export |

Every shared rule and every limit holds in a Next.js app as it does anywhere else (D-137).

## Checks

| Id                               | Stage       | Command                                                                                                                                 |
| -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript/eslint`              | commit      | with the additions above                                                                                                                |
| `nextjs/typecheck`               | commit      | `next typegen` under `CI=1`, then `tsc --noEmit`; takes over `typescript/tsc` in its scope (D-99)                                       |
| `nextjs/build`                   | push, build | `next build` when `[tools.next] build_in_gate = true`                                                                                   |
| `integrity/route-segments`       | commit      | no segment holds both `page` and `route`                                                                                                |
| `integrity/next-config`          | commit      | `next.config.*` parsed as syntax: no secret in `env`, no `eslint.ignoreDuringBuilds`, no `typescript.ignoreBuildErrors`                 |
| `integrity/css-usage`            | push        | every CSS module class used and defined                                                                                                 |
| `integrity/locales`              | push        | ICU parse, no empty message, keys without dots, every locale complete against the base, every message key used through the type checker |
| `integrity/required-rules`       | push        | the required rule list still resolves per file class                                                                                    |
| `integrity/dependency-alignment` | commit      | `next` and `eslint-config-next` on one version; `react` and `react-dom` on one version                                                  |
| `integrity/manifest-policy`      | commit      | pinned `packageManager`, one lockfile, sorted manifests                                                                                 |

## Settings

| Setting                                            | Default                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `architecture.route_directories`                   | `app`, `pages`                                                          |
| `architecture.shared_directories`                  | `components`, `lib`, `hooks`, `config`, `validators`, `types`, `server` |
| `architecture.feature_contracts`                   | `index`, `public`, `contracts`                                          |
| `architecture.imports_allowed` (from, to, reason)  | none                                                                    |
| `tools.next.translations` (directory, base locale) | detected from next-intl configuration                                   |
| `tools.next.build_in_gate`                         | false                                                                   |
| `tools.next.build_flags`                           | `[]`; `["--webpack"]` for an app that does not build with Turbopack     |
| `tools.eslint.restricted_imports` (name, message)  | none; the reference picture-component rule is one entry                 |

## Rule files

`framework/nextjs/NEXTJS.md`, `framework/nextjs/SECURITY.md`, `runtime/node/NODE.md`,
`runtime/browser/BROWSER.md`; `runtime/workers/WORKERS.md` through cloudflare when `@opennextjs/cloudflare` is
present; `library/next-intl/NEXTINTL.md` when `next-intl` is a dependency.
