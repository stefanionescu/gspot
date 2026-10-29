import { GIT_FOLDER } from '#cli/config/repository/files/tracked.ts';

export const COMPOSE_OVERRIDE = /^(?<base>compose|docker-compose)\.[^.]+\.ya?ml$/u;

export const COMPOSE_SUFFIXES = ['.yaml', '.yml'] as const;

export const COMPOSE_CHECK = 'docker/compose';

export const COMPOSE_FILE_FLAG = '-f';

export const DOCKERIGNORE_PATTERNS = [GIT_FOLDER, '.env'] as const;

export const EDGE_SLASHES = /^\/|\/$/gu;

export const IGNORE_PATTERN_FORMS = [
    ['', ''],
    ['**/', ''],
    ['', '*'],
    ['**/', '*'],
] as const;

export const DOCKERIGNORE = '.dockerignore';

export const EXCLUDE_ALL_LINES: ReadonlySet<string> = new Set(['*', '**', '**/*']);

export const TRIVY_FINDINGS_EXIT_CODE = 10;

export const TRIVY_IMAGE_COMMAND = [
    'trivy',
    'image',
    '--quiet',
    '--format',
    'json',
    '--scanners',
    'vuln,secret',
    '--exit-code',
    String(TRIVY_FINDINGS_EXIT_CODE),
    '--config',
] as const;

export const TRIVY_CONFIG_FILE = 'trivy';

export const RULES = { missingFile: 'missing-file', missingEntry: 'missing-entry', secret: 'secret' } as const;
