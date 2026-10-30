import type { Group } from '#cli/types/configurations.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';

export const ESLINT_MANIFEST_TOOL = 'eslint';

export const STYLELINT_MANIFEST_TOOL = 'stylelint';

export const CONFIGURATIONS_FOLDER = 'configurations';

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
} as const satisfies Record<Group, string>;

export const LEVELS = ['basic', 'all'] as const;

export const STAGES = ['commit', 'push', 'manual', 'message'] as const;

export const CHECK_RUNS = ['files', 'scope', 'once', 'history'] as const;

export const CHECK_NEEDS = ['build', 'docker', 'network'] as const;

export const CHECK_CWD_VALUES = ['root', 'scope'] as const;

export const TOOL_KINDS = ['program', 'library'] as const;

export const PYTHON_CONFIGURATION = 'python';

export const TOOL_BUILDS = OPERATING_SYSTEMS.flatMap(
    (system) => [system.name, `${system.name}-x64`, `${system.name}-arm64`] as const,
);

export const SHIPPED_CONFIG_FILES_FOLDER = 'config-files';

export const SWIFT_CONFIGURATION = 'swift';

export const JAVASCRIPT_CONFIGURATION = 'javascript';

export const NEXTJS_CONFIGURATION = 'nextjs';

export const NESTJS_CONFIGURATION = 'nestjs';

export const FORMAT_CONFIGURATION = 'format';

export const OPENAPI_CONFIGURATION = 'openapi';

export const SITE_CONFIGURATION = 'site';

export const TRPC_CONFIGURATION = 'trpc';

export const REACT_NATIVE_CONFIGURATION = 'react-native';

export const TYPESCRIPT_CONFIGURATION = 'typescript';

export const LICENSES_CONFIGURATION = 'licenses';
