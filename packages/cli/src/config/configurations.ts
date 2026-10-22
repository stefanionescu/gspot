import type { Group, Check } from '#cli/types/configurations.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';

export const ESLINT_MANIFEST_TOOL = 'eslint';

export const ESLINT_RUNTIME_NAMES_FILE = 'configurations/language/javascript/eslint-runtime-names.json';

export const ESLINT_RULE_NAMES_FILE = 'configurations/language/javascript/eslint-rule-names.json';

export const COMMAND_CHECK_DEFAULTS = {
    level: 'recommended',
    runs: 'files',
    files: {
        extensions: [],
        filenames: [],
        tags: [],
        languages: false,
        prettier_plugins: false,
        eslint_plugins: false,
        kinds: ['source', 'generated'],
    },
} satisfies Pick<Check, 'level' | 'runs'> & {
    files: Omit<NonNullable<Check['files']>, 'paths'>;
};

export const SOURCE_FILE_GROUPS = ['language', 'framework'] as const;

export const MANIFEST_FILE = 'manifest.toml';

export const CONFIGURATIONS_FOLDER = 'configurations';

/** The rules folder in each shipped configuration. */
export const RULES_FOLDER = 'rules';

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

/** Display labels for each configuration group, in init order. */
export const GROUP_LABELS = {
    language: 'Languages',
    framework: 'Frameworks',
    platform: 'Platforms',
    database: 'Databases',
    testing: 'Testing',
    infrastructure: 'Infrastructure',
    library: 'Libraries',
    general: 'General',
} as const satisfies Record<Group, string>;

export const MAX_EXIT_CODE = 255;

/** The levels, in selection order. */
export const LEVELS = ['recommended', 'all'] as const;

export const STAGES = ['commit', 'push', 'manual', 'message'] as const;

/** A minimum version may leave out the minor or patch number. */
export const MINIMUM_VERSION_PATTERN = /^(?:\d+|\d+\.\d+|\d+\.\d+\.\d+)$/u;

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

export const SVELTE_CONFIGURATION = 'svelte';

export const VUE_CONFIGURATION = 'vue';

export const LICENSES_CONFIGURATION = 'licenses';

export const OPENAPI_CONFIGURATION = 'openapi';

export const FORMAT_CONFIGURATION = 'format';

export const SWIFT_CONFIGURATION = 'swift';

export const SITE_CONFIGURATION = 'site';

export const TRPC_CONFIGURATION = 'trpc';

export const REACT_NATIVE_CONFIGURATION = 'react-native';

export const NESTJS_CONFIGURATION = 'nestjs';

export const NEXTJS_CONFIGURATION = 'nextjs';

export const TYPESCRIPT_CONFIGURATION = 'typescript';

export const JAVASCRIPT_CONFIGURATION = 'javascript';
