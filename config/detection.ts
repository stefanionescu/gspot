export const MANIFEST_NAMES = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'Package.swift',
  'go.mod',
  'Cargo.toml',
  'Gemfile',
] as const

export const NPM_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

export type Signal =
  | { readonly presets: readonly string[]; readonly kind: 'dependency'; readonly names: readonly string[] }
  | { readonly presets: readonly string[]; readonly kind: 'file'; readonly pattern: RegExp }

export const SIGNALS: readonly Signal[] = [
  { presets: ['framework:nextjs'], kind: 'dependency', names: ['next'] },
  { presets: ['framework:nextjs'], kind: 'file', pattern: /^(?:.*\/)?next\.config\.[cm]?[jt]s$/u },
  { presets: ['library:zod'], kind: 'dependency', names: ['zod'] },
  {
    presets: ['library:next-intl'],
    kind: 'dependency',
    names: ['next-intl', 'i18next', 'react-intl', '@formatjs/intl'],
  },
  { presets: ['framework:express'], kind: 'dependency', names: ['express'] },
  { presets: ['framework:fastapi'], kind: 'dependency', names: ['fastapi'] },
  { presets: ['tool:vitest'], kind: 'dependency', names: ['vitest'] },
  { presets: ['tool:pytest'], kind: 'dependency', names: ['pytest'] },
  { presets: ['library:drizzle'], kind: 'dependency', names: ['drizzle-orm'] },
  { presets: ['library:trpc'], kind: 'dependency', names: ['@trpc/server'] },
  { presets: ['library:tanstack-query'], kind: 'dependency', names: ['@tanstack/react-query'] },
  { presets: ['library:zustand'], kind: 'dependency', names: ['zustand'] },
  { presets: ['library:react-hook-form'], kind: 'dependency', names: ['react-hook-form'] },
  {
    presets: ['platform:supabase', 'database:postgres'],
    kind: 'file',
    pattern: /(?:^|\/)supabase\/config\.toml$/u,
  },
  { presets: ['platform:cloudflare'], kind: 'file', pattern: /(?:^|\/)wrangler\.(?:jsonc?|toml)$/u },
  {
    presets: ['platform:cloudflare'],
    kind: 'file',
    pattern: /(?:^|\/)functions\/_(?:middleware|worker)\.[cm]?js$/u,
  },
  { presets: ['language:swift', 'tool:xcode'], kind: 'file', pattern: /\.xcodeproj\//u },
  { presets: ['language:swift'], kind: 'file', pattern: /(?:^|\/)Package\.swift$/u },
  { presets: ['language:typescript'], kind: 'file', pattern: /(?:^|\/)tsconfig(?:\.[\w-]+)?\.json$/u },
  {
    presets: ['language:python'],
    kind: 'file',
    pattern: /(?:^|\/)(?:pyproject\.toml|requirements[\w.-]*\.txt)$/u,
  },
  {
    presets: ['tool:docker'],
    kind: 'file',
    pattern: /(?:^|\/)(?:Dockerfile[\w.-]*|[\w.-]+\.dockerfile)$/u,
  },
  { presets: ['tool:nginx'], kind: 'file', pattern: /(?:^|\/)nginx\.conf$/u },
  { presets: ['repository:commits'], kind: 'file', pattern: /(?:^|\/)\.?commitlint[\w.-]*$/u },
]

export const TOOL_CONFIGS = [
  { tool: 'eslint', pattern: /(?:^|\/)(?:\.eslintrc[\w.]*|eslint\.config\.[cm]?[jt]s)$/u, ownable: true },
  { tool: 'prettier', pattern: /(?:^|\/)\.prettierrc[\w.]*$/u, ownable: true },
  { tool: 'typos', pattern: /(?:^|\/)(?:typos|_typos)\.toml$/u, ownable: true },
  { tool: 'markdownlint', pattern: /(?:^|\/)\.markdownlint[\w.-]*$/u, ownable: true },
  { tool: 'commitlint', pattern: /(?:^|\/)(?:\.)?commitlint[\w.-]*$/u, ownable: true },
  { tool: 'shellcheck', pattern: /(?:^|\/)\.shellcheckrc$/u, ownable: true },
  { tool: 'sqlfluff', pattern: /(?:^|\/)\.?sqlfluff$/u, ownable: true },
  { tool: 'swiftlint', pattern: /(?:^|\/)\.swiftlint\.ya?ml$/u, ownable: true },
  { tool: 'gitleaks', pattern: /(?:^|\/)\.gitleaks\.toml$/u, ownable: true },
  { tool: 'stylelint', pattern: /(?:^|\/)\.stylelintrc[\w.]*$/u, ownable: true },
  { tool: 'hadolint', pattern: /(?:^|\/)\.hadolint\.ya?ml$/u, ownable: true },
  { tool: 'yamllint', pattern: /(?:^|\/)\.yamllint[\w.]*$/u, ownable: true },
  { tool: 'knip', pattern: /(?:^|\/)knip\.jsonc?$/u, ownable: true },
  { tool: 'semgrep', pattern: /(?:^|\/)\.semgrep\.ya?ml$/u, ownable: true },
  { tool: 'lychee', pattern: /(?:^|\/)lychee\.toml$/u, ownable: true },
  { tool: 'syncpack', pattern: /(?:^|\/)\.syncpackrc[\w.]*$/u, ownable: true },
  { tool: 'qlty', pattern: /(?:^|\/)\.qlty\/qlty\.toml$/u, ownable: false },
]

export const RUNNER_SIGNALS = [
  { runner: 'mise', pattern: /(?:^|\/)(?:\.)?mise[\w.]*\.toml$/u },
  { runner: 'bun', pattern: /^bun\.lockb?$/u },
  { runner: 'npm', pattern: /^package-lock\.json$/u },
] as const

export const HOOK_RUNNER_PATTERN = /^(?:\.husky|\.githooks|\.lefthook)[/.]/u
