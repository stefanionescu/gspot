export const LIST_SCOPE_SETTINGS = `level = "all"
configurations = ["bash", "format", "dependencies"]
test_files = ["checks/**"]
[limits]
file_lines = 250
[format]
indent_width = 4
[dependencies]
min_release_age_days = 14
allowed_registries = { value = ["registry.npmjs.org", "registry.example.com"], reason = "The repository resolves packages through both registries." }
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.file_lines = 200
format.indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
limits.sql.file_lines = 30
tools.sqlfluff.dialect = "postgres"
`;

export const LIST_SCOPE_ROWS = [
    'dependencies.allowed_registries          ["registry.npmjs.org","regi… adding              gspot.toml',
    'dependencies.min_release_age_days        14                           lowering            gspot.toml',
    'limits.file_lines                        250                          raising             gspot.toml',
    'test_files                               ["checks/**"]                                    gspot.toml',
    'limits.file_lines                        200                          raising             [scope "api"]  [scope api]',
] as const;

export const SHFMT_IGNORE_SETTINGS = {
    tables: `[[ignore]]
check = "bash/shfmt"
reason = "Review this separately."
`,
} as const;

export const CONFIGURATION_LIST_TEXT =
    "selected\n  bash\n    bash/zsh-syntax  root: no matching files\n    bash/shellcheck  root: on\n    bash/shfmt  root: on\n    bash/script-layout  root: off (level)\n    bash/doc-comments  root: off (level)\n    bash/unused-functions  root: on\n    bash/unread-arguments  root: on\n    bash/function-size  root: off (level)\n    bash/inline-scripts  root: off (level)\n    bash/safety  root: on\n  commits\n    commits/commitlint  root: off (level)\n    commits/commitlint-pushed  root: off (level)\n  data-files\n    data-files/taplo-format  root: on\n    data-files/yamllint  root: no matching files\n    data-files/v8r  root: on\n    data-files/xmllint  root: no matching files\n  dependencies\n    dependencies/osv-scanner  root: no matching files\n    dependencies/syncpack  root: off (level)\n    dependencies/lockfiles  root: no matching files\n    dependencies/stale-lockfile  root: no matching files\n    dependencies/package-manager-pin  root: no matching files\n  docs\n    docs/lychee  root: no matching files\n    docs/lychee-external  root: no matching files\n    docs/missing-paths  root: on\n    docs/required-files  root: off (level)\n  duplication\n    duplication/jscpd  root: off (level)\n  engineering\n  format\n    format/prettier  root: no matching files\n    format/editorconfig-checker  root: on\n  gspot\n    gspot/conflicting-config-files  root: on\n    gspot/generated-files  root: on\n    gspot/unmatched-paths  root: on\n    gspot/suppressions  root: on\n  naming\n    naming/identifiers  root: off (level)\n    naming/paths  root: off (level)\n    naming/allowed-names  root: off (level)\n  prose\n    prose/vale  root: on\n  repository\n    repository/large-files  root: on\n    repository/local-files  root: on\n    repository/encoding  root: on\n  secrets\n    secrets/gitleaks-staged  root: on\n    secrets/gitleaks-pushed  root: on\n    secrets/dotenv-linter  root: no matching files\n    secrets/env-examples  root: on\n  security\n    security/semgrep  root: on\n    security/semgrep-registry  root: on\n  spelling\n    spelling/typos  root: on\n  structure\n    structure/import-rules  root: no matching files\n    structure/lone-files  root: off (level)\n    structure/pass-through-folders  root: off (level)\n    structure/shared-prefixes  root: off (level)\n    structure/file-folder-clashes  root: off (level)\n    structure/long-files  root: off (level)\n    structure/trivial-functions  root: off (level)\n    structure/bare-blocks  root: off (level)\n    structure/environment-readers  root: off (level)\n\navailable\n  ansible  Ansible playbooks, roles, and collections: the lint rules of the Ansible project.\n  astro  Astro components: the recommended and accessibility rules for frontmatter, markup, and scripts, and a type check of each component.\n  cloudflare  Cloudflare Pages and Workers: valid headers and redirects files and current binding types. Level all adds security rules for worker code.\n  css  Style sheets and the style blocks of components: the standard stylelint rules and one layout. SCSS gets formatting only.\n  docker  Dockerfiles and Compose files: Dockerfile best practices, valid Compose files, a `.dockerignore` beside each Dockerfile, and image vulnerability scans.\n  drizzle  Drizzle: no update or delete without `where`, and migrations that match the schema.\n  expo  Expo apps: rules for public environment variables and DOM exports, and Expo's own project and SDK checks. The React Native configuration adds the component and style rules.\n  express  Express services: security rules for request handlers.\n  fastapi  FastAPI routes: route rules, and security rules for request handlers when the security configuration is on.\n  github-actions  GitHub Actions workflows: valid syntax and expressions, security audits, and pinned actions.\n  html  HTML files: valid structure, accessibility, and no inline scripts or event handlers.\n  javascript  JavaScript files: the shipped lint rules, type checks through JSDoc, and no unused code.\n  jest  Jest suites: test lint rules, and passing tests before every push. Level all adds a coverage minimum.\n  licenses  Installed dependencies: a license on the allowed list, or an allowed-package record with a reason for one package.\n  markdown  Markdown files: one style and layout, and code blocks that parse.\n  nestjs  NestJS services: the compiler options that decorators need, correct providers, routes, and DTOs.\n  nextjs  Next.js apps: the framework and hooks rules, and server code that never reaches the client. A Semgrep rule refuses ignoreBuildErrors and ignoreDuringBuilds in next.config.\n  nginx  nginx configuration: security mistakes, and a configuration test in a container.\n  openapi  OpenAPI documents: the committed document passes its lint rules and matches what its generator writes.\n  postgres  Postgres migrations: no locking or breaking changes, a fixed order, no edits after they ran, row-level security, explicit grants, and an index under every foreign key.\n  pytest  pytest suites: test lint rules, and passing tests before every push. Level all adds a coverage minimum.\n  python  Python sources: lint, layout, strict types, import contracts, docstrings that match their signatures, and no unused code or dependencies.\n  react  React components: the recommended React and hooks rules as errors, and react-refresh rules, so Fast Refresh keeps component state.\n  react-dom  React apps in the browser: labels, alternative text, keyboard access, and valid ARIA attributes.\n  react-hook-form  React Hook Form: each form validates through a resolver, and no registered field also acts as a controlled one.\n  react-native  React Native apps: stable list keys, virtualized lists, touch targets that respond, and no credentials in AsyncStorage.\n  site  Sites built to a folder: the build, broken links, page weight, and the sitemap.\n  sql  SQL files: layout, capitalization, and references in the dialect of your database. Level `all` adds the join, cast, subquery, and `LIMIT` rules.\n  supabase  A Supabase project: edge functions under Deno. Every storage bucket has a policy, and privileged keys stay in their allowed files.\n  svelte  Svelte components: markup and script rules, HTML injection checks at both levels, and DOM and typing rules at level all.\n  swift  Swift sources and their XCTest and Swift Testing tests: lint and analyzer rules for each level, one format, a clean build, no unused code, a reason on each disabled test, and passing tests, with a coverage minimum at level all.\n  tanstack-query  TanStack Query: complete dependency lists, stable clients, and options in a fixed order.\n  testing-library  Testing Library tests: the lint rules of Testing Library for each framework package in use.\n  translations  Translated interfaces: next-intl message files that parse and hold every key of the base locale. Level all adds no literal text in components.\n  trpc  tRPC routers: every procedure validates its input, and client code imports the server files named in `trpc.server_files` as types only.\n  typescript  TypeScript files: the strict compiler and the shipped lint and structure rules.\n  vitest  Vitest suites: test lint rules, and passing tests before every push. Level all adds a coverage minimum.\n  vue  Vue components: template, script, and accessibility rules, HTML injection checks at both levels, and naming and ordering rules at level all.\n  xcode  An Xcode project: property lists that parse, complete string catalogs, asset catalogs that hold their images, Swift files that belong to a target, no arbitrary loads, and entitlements on a list.\n  zod  Zod schemas: no unsafe APIs, and the replacement for each deprecated one.\n  zustand  Zustand: state lives in store files, and components read it through a selector.\n";
export const SCOPE_CHECK_LIST_ROWS = [
    '    bash/zsh-syntax  root: no matching files, api: no matching files, api/worker: no matching files',
    '    bash/shellcheck  root: on, api: on, api/worker: on',
    '    bash/shfmt  root: on, api: off (ignore), api/worker: off (ignore)',
    '    bash/script-layout  root: off (level), api: off (level), api/worker: off (level)',
    '    bash/doc-comments  root: off (level), api: off (level), api/worker: off (level)',
    '    bash/unused-functions  root: on, api: on, api/worker: on',
    '    bash/unread-arguments  root: on, api: on, api/worker: on',
    '    bash/function-size  root: off (level), api: off (level), api/worker: off (level)',
    '    bash/inline-scripts  root: off (level), api: off (level), api/worker: off (level)',
    '    bash/safety  root: on, api: on, api/worker: on',
    '    commits/commitlint  root: off (level)',
    '    commits/commitlint-pushed  root: off (level)',
    '    data-files/taplo-format  root: on',
    '    data-files/yamllint  root: no matching files, api: no matching files, api/worker: no matching files',
    '    data-files/v8r  root: on',
    '    data-files/xmllint  root: no matching files',
    '    dependencies/osv-scanner  root: no matching files',
    '    dependencies/syncpack  root: off (level)',
    '    dependencies/lockfiles  root: no matching files, api: no matching files, api/worker: no matching files',
    '    dependencies/stale-lockfile  root: no matching files, api: no matching files, api/worker: no matching files',
    '    dependencies/package-manager-pin  root: no matching files, api: no matching files, api/worker: no matching files',
    '    docs/lychee  root: no matching files, api: no matching files, api/worker: no matching files',
    '    docs/lychee-external  root: no matching files, api: no matching files, api/worker: no matching files',
    '    docs/missing-paths  root: on',
    '    docs/required-files  root: off (level)',
    '    duplication/jscpd  root: off (level), api: off (level), api/worker: off (level)',
    '    format/prettier  root: no matching files',
    '    format/editorconfig-checker  root: on',
    '    gspot/conflicting-config-files  root: on',
    '    gspot/generated-files  root: on',
    '    gspot/unmatched-paths  root: on',
    '    gspot/suppressions  root: on',
    '    naming/identifiers  root: off (level), api: off (level), api/worker: off (level)',
    '    naming/paths  root: off (level), api: off (level), api/worker: off (level)',
    '    naming/allowed-names  root: off (level)',
    '    prose/vale  root: on',
    '    repository/large-files  root: on',
    '    repository/local-files  root: on',
    '    repository/encoding  root: on',
    '    secrets/gitleaks-staged  root: on',
    '    secrets/gitleaks-pushed  root: on',
    '    secrets/dotenv-linter  root: no matching files',
    '    secrets/env-examples  root: on, api: on, api/worker: on',
    '    security/semgrep  root: on, api: on, api/worker: on',
    '    security/semgrep-registry  root: on, api: on, api/worker: on',
    '    spelling/typos  root: on, api: on, api/worker: on',
    '    structure/import-rules  root: no matching files, api: no matching files, api/worker: no matching files',
    '    structure/lone-files  root: off (level), api: off (level), api/worker: off (level)',
    '    structure/pass-through-folders  root: off (level), api: off (level), api/worker: off (level)',
    '    structure/shared-prefixes  root: off (level), api: off (level), api/worker: off (level)',
    '    structure/file-folder-clashes  root: off (level), api: off (level), api/worker: off (level)',
    '    structure/long-files  root: off (level), api: off (level), api/worker: off (level)',
    '    structure/trivial-functions  root: off (level), api: off (level), api/worker: off (level)',
    '    structure/bare-blocks  root: off (level), api: off (level), api/worker: off (level)',
    '    structure/environment-readers  root: off (level), api: off (level), api/worker: off (level)',
] as const;
