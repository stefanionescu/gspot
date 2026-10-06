# READMEs, Guides, Reference, and the Docs Site

Architecture material from the original audit follows. Current repository decisions are recorded in [progress](../progress.json).

## Target layout

```text
TODAY
README.md                      Install (npm dev dependency, then "or global"), What it catches, Documentation, License
packages/cli/README.md         Install (same two methods), Documentation ("manual" -> gspot.dev), License
packages/eslint-plugin/README.md
CONTRIBUTING.md
docs/README.md                 how to build the site (the README "docs" badge points here)
gspot.dev                      (not deployed; every path returns 404)
├─ /                           hero: "npx @gspothq/cli init" (a third install method), recorded example, 3 features
├─ Get started  (collapsed)
│  ├─ Overview                 /guides/overview/
│  ├─ Install                  /guides/install/
│  ├─ Quickstart               /guides/quick-start/            TypeScript only
│  └─ Existing repositories    /guides/existing-repository/
├─ Guides  (collapsed)
│  ├─ Fix findings             /guides/findings/
│  ├─ The policy file          /guides/customize/
│  ├─ Coding agents            /guides/agents/
│  ├─ Hooks and CI             /guides/hooks/
│  ├─ Generated files          /guides/generated-files/
│  ├─ Monorepos                /guides/scopes/
│  ├─ Team profiles            /guides/profiles/
│  ├─ Package managers         /guides/without-mise/
│  ├─ Custom checks            /guides/project-checks/
│  ├─ Tests and coverage       /guides/testing/
│  ├─ Dependency licenses      /guides/dependency-licenses/
│  ├─ Security                 /guides/security/
│  └─ Troubleshooting          /guides/troubleshooting/
└─ Reference  (collapsed)
   ├─ Commands                 index + 12 pages labeled by summary ("Set up gspot in a repository", ...)
   ├─ Kits                     index + 53 pages
   ├─ Checks                   199 pages in about 50 folder groups, no index, labeled by title, not ID
   ├─ ESLint plugin            22 pages, no index
   ├─ Settings                 one table of about 200 rows
   └─ Policy file              one page, 2,276 rows of JSON-schema fragments (about 250 KB)

AFTER
README.md
  1. What gspot does          3 sentences; no "lints AI-generated code"
  2. Status                   "Not yet on npm" until the first release (then delete)
  3. Requirements             Git; Node.js 22+ (or Bun); uv; mise 2026.8.8+ or the native tools
  4. Install                  per project type (outline below)
  5. Example                  10-line excerpt of a rejected commit; link to the quickstart
  6. Documentation            links that resolve
  7. Contributing, License
packages/cli/README.md        sections 1-4 and 6 of README, word for word (this is the npm page)
packages/eslint-plugin/README.md   link to a real rule index; "Name your own files" -> "Rules that need options"
CONTRIBUTING.md               fix stale test path; say what the example replay covers
gspot.dev
├─ /                          install command per project type (tabs: has package.json / mise / other)
├─ Get started  (expanded)
│  ├─ What gspot does                 /guides/overview/       + Concepts: kit, check, level, stage, scope, runner, policy
│  ├─ Requirements                    /guides/requirements/   NEW
│  ├─ Install                         /guides/install/        decision table, one section per method
│  ├─ Quickstart: TypeScript          /guides/quickstart/typescript/
│  ├─ Quickstart: Python              /guides/quickstart/python/      NEW (uv project, mise runner)
│  ├─ Quickstart: Swift               /guides/quickstart/swift/       NEW (Swift package, macOS)
│  ├─ Add gspot to an existing repository  /guides/existing-repository/
│  └─ Join a repository that uses gspot    /guides/join/       NEW, split from Install
├─ Daily use
│  ├─ Fix findings                    /guides/findings/
│  ├─ Git hooks                       /guides/hooks/          all three hooks, hook managers
│  ├─ CI                              /guides/ci/             split from hooks: GitHub, GitLab, your own pipeline
│  └─ Coding agents                   /guides/agents/
├─ Configure
│  ├─ The policy file                 /guides/policy/         was customize: levels, limits, ignores, enable
│  ├─ Exclude files                   /guides/exclude/        NEW: exclude, generated, vendored, tests
│  ├─ Monorepos                       /guides/monorepos/      was scopes
│  ├─ Runners: mise, npm, pnpm, Yarn, Bun, none  /guides/runners/   was without-mise
│  ├─ Files gspot writes              /guides/generated-files/
│  ├─ Custom checks                   /guides/custom-checks/  was project-checks
│  ├─ Team profiles                   /guides/profiles/
│  └─ Upgrade gspot                   /guides/upgrade/        NEW, moved out of customize
├─ Topics
│  ├─ Tests and coverage
│  ├─ Dependency licenses
│  └─ Security
├─ Troubleshooting                    one section per error message, quoted
└─ Reference
   ├─ Commands                index + pages titled "gspot init", "gspot check", ...; global options on the index only
   ├─ Settings                Direction column explained
   ├─ gspot.toml schema       one section per table: TOML example + key list; JSON schema linked
   ├─ Kits                    index; each page adds "Selected when", "You install", Level column
   ├─ Checks                  NEW index table (ID, kit, stage, level, tool); pages titled by ID
   ├─ ESLint plugin           NEW index; pages titled gspot/<rule>
   └─ Exit codes and environment variables   NEW (0/1/2, GSPOT_JOBS, GITHUB_TOKEN)
Cut or merge: Overview table and README init list and homepage copy say the same thing (keep one, link);
the recorded output appears in 3 hand copies (render from example.json or keep one); level wording exists
in 4 versions (keep one, link).

README INSTALL SECTION (outline)
## Install
gspot is an npm package. You need:
- Git, and Node.js 22 or newer (Bun also works)
- uv, which installs the Python-based linters (every setup has some, such as yamllint)
- mise 2026.8.8 or newer, which installs the native linters (gitleaks, typos, ShellCheck, SwiftLint, ...).
  Without mise, install them yourself; `gspot doctor` lists them with install commands.
Commit or stash your work first: `gspot init` stops when the working tree has changes.

Choose one way, by project:
| Your repository | Install and set up | Hooks and CI run |
| has package.json (JS, TS, any npm repo) | npm install --save-dev --save-exact @gspothq/cli | npx gspot |
| | git commit -am "build: Add gspot"  then  npx gspot init | |
| | (pnpm add -D -E / yarn add -D -E / bun add -d --exact) | pnpm exec / yarn / bunx |
| no package.json (Python, Swift, shell, | npx @gspothq/cli@<version> init, answer "mise" to | mise exec -- gspot |
| Docker, Go, ...): use mise | "Task runner?"; mise then pins gspot and every native tool | |
| no package.json and no mise | npm install --global @gspothq/cli@<version>, then gspot init | gspot on PATH |
| | One machine runs one version; every repository must pin it. | |
Then:
1. Read the plan. It lists the kits, the files it writes and replaces, and the hooks.
2. Accept. gspot writes the files and installs the tools.
3. git add -A && git commit -m "chore: Set up gspot"
4. Teammates: install dependencies (or `mise install`), then run `gspot install` once.
Commands in the docs start with `gspot`; type them with the prefix from the table.
```
