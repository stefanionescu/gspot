import type { Manifest, MiseBackend } from '#cli/types/configurations.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

/** The rule assets within each shipped configuration. */
export const CONFIGURATION_RULES_FOLDER = 'rules';

/** The fields two configurations may set differently when both declare one setting. */
export const SETTING_DEFAULT_FIELDS = new Set(['default', 'default_all']);

export const SENTENCE_MIN_CHARS = 12;

export const CONFIG_PREFIX = `${CONFIGURATION_DIRECTORY}/`;

export const NAMING_TERMS_FILE = 'configurations/general/naming/policy.json';

/** Display labels for every validated configuration kind, in initialization order. */
export const CONFIGURATION_LABELS: Record<Manifest['configuration']['kind'], string> = {
    language: 'Languages',
    framework: 'Frameworks',
    platform: 'Platforms',
    database: 'Databases',
    tool: 'Tools',
    library: 'Libraries',
    general: 'Repository',
};

export const MISE_BACKENDS: MiseBackend[] = [
    { installer: 'mise', prefix: '' },
    { installer: 'npm', prefix: 'npm:' },
    { installer: 'pypi', prefix: 'pipx:' },
    { installer: 'github', prefix: 'github:' },
    { installer: 'cargo', prefix: 'cargo:' },
];

/** Tool project trees owned and replaced as complete installations. */
export const INSTALLATION_KINDS = ['npm', 'python', 'vale'] as const;

/** The npm backend that installs the published CLI. */
export const GSPOT_MISE_TOOL = 'npm:@gspothq/cli';

/** A manifest-owned file list reads the scope's already resolved repository-relative tests. */
export const TEST_FILES_PLACEHOLDER = '{setting:test_files}';

export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

export const TOOL_FILE_PLACEHOLDER = /\{tool_file:(?<name>[a-z0-9-]+)\}/gu;

export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const WORKSPACE_PREFIX = '{workspace:';

export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;

export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const FILES_PLACEHOLDER = '{files}';

export const FILE_PLACEHOLDER = '{file}';

export const TARGET_PLACEHOLDER = /\{target(?:_json|_module)?\}/gu;

/** Authored manifest sections follow their dependency and generation order. Nested values stay inline. */
export const MANIFEST_TABLE_ORDER = [
    'configuration',
    'detect',
    'files',
    'set',
    'set_all',
    'tool',
    'tool.replace',
    'tool_file',
    'check',
    'setting',
    'required_eslint_rules',
    'eslint_rules_off',
    'ruff_rules',
    'naming.overrides',
    'agent_rules',
];
