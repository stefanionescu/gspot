import { GIT_FOLDER } from '#cli/config/repository/tracked.ts';

export const DOCKERIGNORE_ENTRIES = [GIT_FOLDER, '.env'] as const;

/** The exit code that Trivy returns for findings, set with --exit-code. */
export const TRIVY_EXIT = 10;

export const COMPOSE_OVERRIDE = /^(?<base>compose(?=\.override\.)|docker-compose)\.[^.]+\.ya?ml$/u;

export const TRIVY_SCHEMA_VERSION = 2;

export const DOCKER_TOOL = 'docker';

export const COMPOSE_CHECK = 'docker/compose';

/** The tool file name that the image scan passes to Trivy. */
export const TRIVY_TOOL_FILE = 'trivy';

export const COMPOSE_FILE_FLAG = '-f';

export const COMPOSE_SUFFIXES = ['.yaml', '.yml'] as const;

export const TRIVY_IMAGE_COMMAND = [
    'trivy',
    'image',
    '--quiet',
    '--format',
    'json',
    '--scanners',
    'vuln,secret',
    '--exit-code',
    String(TRIVY_EXIT),
    '--config',
] as const;

export const DOCKERIGNORE = '.dockerignore';

export const EDGE_SLASHES = /^\/|\/$/gu;

export const IGNORE_PATTERN_FORMS = [
    ['', ''],
    ['**/', ''],
    ['', '*'],
    ['**/', '*'],
] as const;
