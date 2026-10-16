import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';

export const SOURCE_FILE_GROUPS = ['language', 'framework'] as const;
export const MANIFEST_FILE = 'manifest.toml';
export const CONFIGURATIONS_FOLDER = 'configurations';

/** The rule assets within each shipped configuration. */
export const RULES_FOLDER = 'rules';

export const NAMING_DEFAULTS_FILE = 'configurations/general/naming/defaults.json';

/** Display labels for every validated configuration group, in initialization order. */
export const GROUPS = [
    'language',
    'framework',
    'platform',
    'database',
    'testing',
    'infrastructure',
    'library',
    'general',
] as const;

export const GROUP_LABELS = {
    language: 'Languages',
    framework: 'Frameworks',
    platform: 'Platforms',
    database: 'Databases',
    testing: 'Testing',
    infrastructure: 'Infrastructure',
    library: 'Libraries',
    general: 'General',
} as const;

export const MISE_BACKENDS = [
    { installer: 'mise', prefix: '' },
    { installer: 'npm', prefix: 'npm:' },
    { installer: 'pypi', prefix: 'pipx:' },
    { installer: 'github', prefix: 'github:' },
    { installer: 'cargo', prefix: 'cargo:' },
] as const;

/** A manifest-owned file list reads the scope's already resolved repository-relative tests. */
export const TEST_FILES_PLACEHOLDER = '{setting:test_files}';

export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

export const TOOL_FILE_PLACEHOLDER = /\{tool_file:(?<name>[a-z0-9-]+)\}/gu;

export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const WORKSPACE_PLACEHOLDER = /^\{workspace:(?<name>[^}]+)\}$/u;

export const WHOLE_SETTING_PLACEHOLDER = /^\{setting:(?<name>[a-z\d_.-]+)\}$/u;

export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;

export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const FILES_PLACEHOLDER = '{files}';

export const FILE_PLACEHOLDER = '{file}';

export const ROOT_PLACEHOLDER = '{root}';

export const SCOPE_PLACEHOLDER = '{scope}';

export const INDENT_PLACEHOLDER = '{indent}';

export const MESSAGE_FILE_PLACEHOLDER = '{message_file}';

export const LEVEL_PLACEHOLDER = /\{level:(?<recommended>[^{}:]+):(?<all>[^{}:]+)\}/gu;

export const TARGET_MODULE_PLACEHOLDER = '{target_module}';
export const TARGET_JSON_PLACEHOLDER = '{target_json}';
export const RULE_PLACEHOLDER = '{rule}';

export const TARGET_PLACEHOLDER = /\{target(?:_json|_module)?\}/gu;

export const MAX_EXIT_CODE = 255;

/** Supported configuration levels, in their selection order. */
export const LEVELS = ['recommended', 'all'] as const;

export const STAGES = ['commit', 'push', 'manual', 'message'] as const;

/** Numeric floors allow an omitted minor or patch version. */
export const VERSION_FLOOR = /^(?:\d+|\d+\.\d+|\d+\.\d+\.\d+)$/u;

export const CHECK_RUNS = ['files', 'scope', 'once', 'history'] as const;
export const CHECK_NEEDS = ['build', 'docker', 'network'] as const;
export const CHECK_WORKING_FOLDERS = ['root', 'scope'] as const;
export const TOOL_KINDS = ['program', 'library'] as const;

export const PYTHON_CONFIGURATION = 'python';
export const NAME_PATTERN = /^[a-z0-9-]+$/u;
export const TOOL_BUILDS = OPERATING_SYSTEMS.flatMap(
    (system) => [system.name, `${system.name}-x64`, `${system.name}-arm64`] as const,
);
export const EXTENSION_PATTERN = /^\.[a-z0-9]+$/u;

export const SHIPPED_TOOL_FILES_FOLDER = 'tool-files';

export const JAVASCRIPT_CONFIGURATION_FOLDER = 'configurations/language/javascript';
