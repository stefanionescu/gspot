const ESLINT_POLICY_OPTIONS = `gspot translates policy settings into plugin rule options:

| Policy setting | Plugin rule | Rule option |
| --- | --- | --- |
| \`architecture.roles.env\` | \`env-owner\` | \`owners\` |
| \`tools.eslint.import_extensions\` | \`import-extensions\` | \`style\` |
| \`limits.index_exports\` | \`max-barrel-reexports\` | \`max\` |
| \`structure.reexports = "index-only"\` | \`no-reexports\` and \`no-trivial-files\` | \`allowIndex: true\` |

Environment ownership and barrel limits apply at level \`all\`. Barrel limits apply when index re-exports are allowed. See the [standalone plugin reference](/reference/plugin/) for the rule options.
`;

/** Introduce setting inheritance and the reason requirements of each direction. */
export const SETTINGS_INTRO = `Settings exposed by \`gspot set\` and \`gspot list settings\`, with defaults from their owners. Any limit can be set for one language as \`limits.<language>.<name>\`. A scope inherits the root and every scope that contains it: scalar values replace inherited values, and lists add to them. See [monorepos](/guides/monorepos/).

Direction describes which changes weaken enforcement and need an entry in \`[reasons]\`:

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
    ['general', 'General'],
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
    tests: 'tests = ["tests/**/*.test.ts"]',
    exclude: 'exclude = ["dist/**"]',
    scope: '[[scope]]\npath = "services/api"\nconfigurations = ["python", "fastapi"]',
    limits: '[limits]\nfunction_lines = 60\n\n[limits.python]\nfile_lines = 300',
    naming: '[[naming.paths]]\npaths = ["migrations/**"]\nallow_digits = true\nreason = "Migration filenames begin with their version."',
    architecture: '[architecture.roles]\nruntime = ["src/**"]\ntests = ["tests/**"]',
    structure: '[structure]\nreexports = "index-only"',
    tools: '[tools.eslint.rules]\n"no-console" = [{ allow = ["warn"] }]',
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

/** Configuration details that explain interactions between tools. */
export const CONFIGURATION_NOTES: Record<string, string> = {
    javascript: ESLINT_POLICY_OPTIONS,
    typescript: ESLINT_POLICY_OPTIONS,
    python: 'An explicit [tool.pydoclint] style in pyproject.toml takes precedence. Otherwise, pydoclint follows the project Ruff pydocstyle convention, then tools.ruff.docstring_convention when it is google or numpy. Other conventions leave the native pydoclint default unchanged.',
};

/** Plain labels for JSON schema types presented in policy tables. */
export const SCHEMA_TYPE_LABELS: Record<string, string> = { array: 'List', object: 'Table' };
