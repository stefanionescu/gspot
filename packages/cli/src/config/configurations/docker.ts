import { GIT_METADATA_NAME, GSPOT_FOLDER, NODE_MODULES } from '#cli/config/system.ts';

export const HADOLINT_FAILURE_THRESHOLD = 'style';

export const TRIVY_SKIPPED_FOLDERS = [NODE_MODULES, GSPOT_FOLDER, GIT_METADATA_NAME] as const;

export const COMPOSE_OVERRIDE = /^(?<base>compose|docker-compose)\.[^.]+\.ya?ml$/u;

export const COMPOSE_SUFFIXES = ['.yaml', '.yml'] as const;

export const COMPOSE_CHECK = 'docker/compose';

export const COMPOSE_FILE_FLAG = '-f';

export const DOCKERIGNORE_PATTERNS = [GIT_METADATA_NAME, '.env'] as const;

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

export const INSTRUCTION_RULES = {
    lockfile: 'lockfile-install',
    pipedDownload: 'piped-download',
    nginxTag: 'nginx-tag',
    shellEntrypoint: 'shell-entrypoint',
    secondIndex: 'extra-index-url',
    remoteAdd: 'remote-add',
    dockerSocket: 'docker-socket',
} as const;

export const INSTRUCTION_MESSAGES = {
    lockfile: 'This install can rewrite the lockfile. Use `npm ci`, or the frozen or locked flag of the tool.',
    pipedDownload: 'Do not pipe a download into a shell. Download a pinned file, check it, then run it.',
    nginxTag: 'Pin nginx to a full version, such as `nginx:1.27.3-alpine`.',
    shellEntrypoint: 'Run the program as the first `ENTRYPOINT` element, so that it receives the stop signal.',
    secondIndex: 'Install from one index, through `--index-url`, instead of adding a second one.',
    remoteAdd: 'Pass `--checksum=sha256:<hash>` to this `ADD`, or download the file in a `RUN` and check its hash.',
    dockerSocket: 'Do not give the container the Docker socket. A process that reads it controls the host.',
} as const;

export const SERVICE_SECURITY_RULES = {
    privileged: 'privileged-container',
    dockerSocket: 'docker-socket',
    unconfined: 'unconfined-profile',
} as const;

export const SERVICE_SECURITY_MESSAGES = {
    privileged: 'Remove `privileged`, and add only the capabilities this service needs with `cap_add`.',
    dockerSocket: 'Do not mount the Docker socket. A process that reads it controls the host.',
    unconfined:
        'Keep the default seccomp, AppArmor, and SELinux profiles, or name a profile that allows what you need.',
} as const;

export const NPM_COMMAND = 'npm';

export const NPM_INSTALL_VERBS: ReadonlySet<string> = new Set(['install', 'i']);

export const LOCKED_INSTALLS: Readonly<Record<string, { verbs: string[]; flags: string[] } | undefined>> = {
    pnpm: { verbs: ['install', 'i'], flags: ['--frozen-lockfile'] },
    bun: { verbs: ['install', 'i'], flags: ['--frozen-lockfile'] },
    yarn: { verbs: ['install'], flags: ['--frozen-lockfile', '--immutable'] },
    uv: { verbs: ['sync'], flags: ['--frozen', '--locked'] },
};

export const NGINX_IMAGE = /(?:^|\/)nginx$/u;

export const PATCH_LEVEL_VERSION = /^\d+\.\d+\.\d+/u;

export const DOCKER_INSTRUCTION = /^[ \t]*(?<name>[A-Za-z]+)[ \t](?<text>(?:[^\n\\]|\\[\s\S])*)$/gmu;

export const LINE_CONTINUATION = /\\\n/gu;

export const EXEC_FORM_START = /^\[\s*"(?<program>[^"]+)"/u;

export const DOCKER_RULES = {
    missingFile: 'missing-file',
    missingEntry: 'missing-entry',
    ignoredSource: 'ignored-source',
    secret: 'secret',
} as const;

export const COPY_FROM_FLAG = '--from=';
