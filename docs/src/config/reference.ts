const ESLINT_POLICY_OPTIONS = `gspot translates policy settings into plugin rule options:

| Policy setting | Plugin rule | Rule option |
| --- | --- | --- |
| \`architecture.roles.env\` | \`env-owner\` | \`owners\` |
| \`tools.eslint.import_extensions\` | \`import-extensions\` | \`style\` |
| \`limits.barrel_reexports\` | \`max-barrel-reexports\` | \`max\` |
| \`structure.reexports = "index-only"\` | \`no-reexports\` and \`no-trivial-files\` | \`allowIndex: true\` |

Environment ownership and barrel limits apply at level \`all\`. Barrel limits apply when index re-exports are allowed. See the [standalone plugin reference](/reference/plugin/) for the rule options.
`;

/** Introduce setting inheritance and the reason requirements of each direction. */
export const SETTINGS_INTRO = `Settings exposed by \`gspot set\` and \`gspot list settings\`, with defaults from their owners. Any limit can be set for one language as \`limits.<language>.<name>\`. A scope inherits the root and every scope that contains it: scalar values replace inherited values, and lists add to them. See [monorepos](/guides/monorepos/).

Direction describes whether a change needs a reason when \`require_reasons = true\`:

- \`neutral\`: neither direction weakens enforcement.
- \`tightening\`: increasing or enabling the value strengthens enforcement.
- \`loosening\`: increasing or enabling the value weakens enforcement.
- \`floor\`: lowering the minimum weakens enforcement.
- \`ceiling\`: raising the maximum weakens enforcement.
- \`rule-options\`: the individual rule's value determines whether enforcement becomes weaker.

`;

/** The files that register commands with dedicated command folders. */
export const COMMAND_OWNERS: Record<string, string> = {
    init: 'commands/init/command.ts',
    doctor: 'commands/doctor/command.ts',
    check: 'commands/check/command.ts',
    explain: 'commands/explain/command.ts',
};

/** Configuration groups in the public index. */
export const CONFIGURATION_GROUPS: [string, string][] = [
    ['language', 'Languages'],
    ['framework', 'Frameworks'],
    ['tool', 'Tools'],
    ['library', 'Libraries'],
    ['platform', 'Platforms'],
    ['database', 'Databases'],
    ['general', 'Repository checks'],
];

/** Labels for the conditions that select configurations and agent rules. */
export const DETECTION_LABELS = {
    extensions: 'file extensions',
    filenames: 'filenames',
    dependencies: 'dependencies',
    shebangs: 'script interpreters',
    tags: 'file tags',
    paths: 'file paths',
    project_files: 'project files',
};

/** Formatting used for published JSON examples and the schema endpoint. */
export const REFERENCE_JSON_INDENT = 2;

/** TOML examples for top-level tables in the readable policy reference. */
export const POLICY_EXAMPLES: Record<string, string> = {
    level: 'level = "recommended"',
    require_reasons: 'require_reasons = true',
    configurations: 'configurations = ["typescript", "nextjs", "markdown"]',
    run_with: 'run_with = "mise"',
    extra_checks: 'extra_checks = ["naming/paths"]',
    tests: 'tests = ["tests/**/*.test.ts"]',
    exclude: 'exclude = ["dist/**"]',
    scope: '[[scope]]\npath = "services/api"\nconfigurations = ["python", "fastapi"]',
    limits: '[limits]\nfunction_lines = 60\n\n[limits.python]\nfile_lines = 300',
    naming: '[[naming.paths]]\npaths = ["migrations/**"]\nallow_digits = true\nreason = "Migration filenames begin with their version."',
    architecture: '[architecture.roles]\nruntime = ["src/**"]\ntests = ["tests/**"]',
    structure: '[structure]\nreexports = "index-only"',
    tools: '[tools.eslint.rules]\n"no-console" = "error"',
    format: '[format]\nindent_width = 4\nprint_width = 100',
    dependencies: '[dependencies]\nmin_release_age_days = 7',
    prose: '[prose]\nvocabulary = ["Acme"]',
    licenses: '[licenses]\nallowed = ["MIT", "Apache-2.0"]',
    ignore: '[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\npaths = ["scripts/**"]\nreason = "Scripts print their results."',
    check: '[[check]]\nname = "project/notes"\ncommand = ["node", "scripts/check-notes.mjs", "{files}"]\npaths = ["notes/**"]\nstage = "commit"\nignore_file = ".notesignore"',
    hooks: '[hooks]\npush_files = "changed"',
    ci: '[ci]\nprovider = "github"\nplatforms = ["linux"]\nfiles = "changed"',
    agent_rules: '[agent_rules]\nenabled = true\ninstruction_files = [".github/copilot-instructions.md"]',
    tool_timeout_seconds: 'tool_timeout_seconds = 300',
    generated: '[[generated]]\npaths = ["src/generated/**"]\ngenerator = "API schema generator"',
    vendored: '[[vendored]]\npaths = ["vendor/**"]\nreason = "Copied from the reviewed upstream library."',
};

/** Plain meanings of plugin options, alongside definition-owned types and defaults. */
export const PLUGIN_OPTIONS: Record<string, Record<string, string>> = {
    'no-client-env': {
        isClient: 'Treat selected files as client code without a use-client directive.',
        publicPrefixes: 'Prefixes allowed for public environment variables.',
        allowed: 'Environment variable names allowed in client code.',
    },
    'import-extensions': {
        style: 'Required suffix for internal code imports.',
        internalPrefixes: 'Prefixes that identify internal imports.',
    },
    'import-direction': {
        roles: 'File patterns identifying each architectural role.',
        aliases: 'Import alias prefixes mapped to repository folders.',
        scope: 'Folder used as the root for role patterns.',
    },
    'no-helpers-beside-tests': {
        harness: 'Test support directory where non-test files belong.',
    },
    'env-owner': {
        owners: 'File patterns allowed to read environment variables.',
        allowed: 'Environment variable names allowed outside those files.',
    },
    'import-boundaries': {
        folders: 'Boundary folders or folder globs. The nearest matching ancestor owns each file. Defaults to */*.',
        aliases: 'Import alias prefixes mapped to folders for fixes.',
    },
    'instances-in-registry': { files: 'File patterns allowed to export new instances.' },
    'no-reexports': { allowIndex: 'Allow re-exports in index files.' },
    'max-barrel-reexports': { max: 'Maximum number of re-export declarations in an index file.' },
    'no-trivial-functions': { maxStatements: 'Functions with this many statements or fewer are reported.' },
    'no-trivial-files': {
        allowIndex: 'Allow an index file when it serves the configured library export contract.',
        maxStatements: 'Statement limit used when identifying trivial functions in a file.',
    },
};

/** Rules that need project-owned selectors before they can report findings. */
export const PLUGIN_REQUIRES_OPTIONS = ['env-owner', 'import-direction', 'no-helpers-beside-tests'];

/** Configuration details that explain interactions between tools. */
export const CONFIGURATION_NOTES: Record<string, string> = {
    javascript: ESLINT_POLICY_OPTIONS,
    typescript: ESLINT_POLICY_OPTIONS,
    python: 'An explicit [tool.pydoclint] style in pyproject.toml takes precedence. Otherwise, pydoclint follows the project Ruff pydocstyle convention, then tools.ruff.docstring_convention when it is google or numpy. Other conventions leave the native pydoclint default unchanged.',
};

/** A second task example for command reference pages, beyond definition-owned help. */
export const COMMAND_EXAMPLES: Record<string, string> = {
    init: 'gspot init --dry-run --yes',
    apply: 'gspot apply',
    add: 'gspot add pytest --scope services/api',
    remove: 'gspot remove nextjs --scope apps/web',
    export: 'gspot --json export team.gspot.template.toml',
    install: 'gspot install --dry-run',
    check: 'gspot check --changed --base origin/main',
    doctor: 'gspot --json doctor',
    explain: 'gspot explain ./src/app.ts',
    ignore: 'gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."',
    set: 'gspot set extra_checks naming/paths',
    list: 'gspot list configurations',
};

/** Plain labels for JSON schema types presented in policy tables. */
export const SCHEMA_TYPE_LABELS: Record<string, string> = { array: 'List', object: 'Table' };
