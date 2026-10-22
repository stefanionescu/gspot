import type { Group } from '#cli/types/configurations.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';

export const ESLINT_MANIFEST_TOOL = 'eslint';

export const CONFIGURATIONS_FOLDER = 'configurations';

/** The configuration groups that a manifest folder may name. */
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

/** The title of each configuration group. init and the docs list the groups in this order. */
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

/** The levels, from the fewest checks to the most. */
export const LEVELS = ['recommended', 'all'] as const;

export const STAGES = ['commit', 'push', 'manual', 'message'] as const;

export const CHECK_RUNS = ['files', 'scope', 'once', 'history'] as const;

export const CHECK_NEEDS = ['build', 'docker', 'network'] as const;

export const CHECK_WORKING_FOLDERS = ['root', 'scope'] as const;

export const TOOL_KINDS = ['program', 'library'] as const;

export const PYTHON_CONFIGURATION = 'python';

export const TOOL_BUILDS = OPERATING_SYSTEMS.flatMap(
    (system) => [system.name, `${system.name}-x64`, `${system.name}-arm64`] as const,
);

export const SHIPPED_CONFIG_FILES_FOLDER = 'config-files';

export const SWIFT_CONFIGURATION = 'swift';

export const JAVASCRIPT_CONFIGURATION = 'javascript';

/** Tool folders replaced as complete installations. */
export const TOOL_FOLDER_KINDS = ['npm', 'python', 'vale'] as const;

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;

export const NEXTJS_CONFIGURATION = 'nextjs';
