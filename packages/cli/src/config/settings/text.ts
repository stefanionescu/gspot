import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const SCHEMA_DIRECTIVE = `#:schema ./${GSPOT_PATHS.settingsSchema}`;

export const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'test_files',
    'tool_timeout_seconds',
] as const;

export const FIRST_TABLES = [
    'hooks',
    'ci',
    'rules',
    'format',
    'limits',
    'naming',
    'structure',
    'dependencies',
    'docs',
    'licenses',
    'spelling',
] as const;

export const LAST_TABLES = ['tools', 'scope', 'import_rule', 'command_check', 'ignore'] as const;
