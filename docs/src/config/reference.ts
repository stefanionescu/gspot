/** Introduce setting inheritance and the reason requirements of each direction. */
export const SETTINGS_INTRO = `Settings exposed by \`gspot set\` and \`gspot list settings\`, with defaults from their owners. Any limit can be set for one language as \`limits.<language>.<name>\`. A scope inherits the root and every scope that contains it: scalar values replace inherited values, and lists add to them. Command argument lists replace inherited arguments intact. See [monorepos](/guides/monorepos/).

The "Loosens when" column describes which changes weaken enforcement and need an entry in \`[reasons]\`. A blank cell means neither direction weakens enforcement:

- \`tightening\`: increasing or enabling the value strengthens enforcement.
- \`loosening\`: increasing or enabling the value weakens enforcement.
- \`floor\`: lowering the minimum weakens enforcement.
- \`ceiling\`: raising the maximum weakens enforcement.
- \`rule-options\`: the individual rule's value determines whether enforcement becomes weaker.

`;

/** The files that register commands with dedicated command folders. */
export const COMMAND_OWNERS: Record<string, string> = {
    init: 'commands/init/public.ts',
    doctor: 'commands/doctor/public.ts',
    check: 'commands/check/command.ts',
    apply: 'commands/public.ts',
    install: 'commands/contracts.ts',
    export: 'commands/contracts.ts',
    explain: 'commands/explain/public.ts',
};

/** Configuration groups in the public index. */
export const CONFIGURATION_GROUPS: [string, string][] = [
    ['language', 'Languages'],
    ['framework', 'Frameworks'],
    ['test', 'Test runners'],
    ['infra', 'Infrastructure'],
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
    runtimes: 'JavaScript runtimes',
    tags: 'file tags',
    paths: 'file paths',
    project_files: 'project files',
};

/** Formatting used for published JSON examples and the schema endpoint. */
export const REFERENCE_JSON_INDENT = 2;

/** Plain labels for JSON schema types presented in policy tables. */
export const SCHEMA_TYPE_LABELS: Record<string, string> = { array: 'List', object: 'Table' };

/** Labels for the manifest check run frequency. */
export const CHECK_RUN_LABELS = {
    once: 'once for the repository',
    scope: 'once per scope',
    files: 'per file',
    history: 'once for pushed history',
};
