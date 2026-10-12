export const NGINX_CONF = 'nginx.conf';

export const CERTIFICATE_ARGUMENTS = [
    'req',
    '-x509',
    '-nodes',
    '-newkey',
    'rsa:2048',
    '-subj',
    '/CN=localhost',
    '-days',
    '1',
] as const;

export const LOCAL_NAMES = new Set(['localhost', 'unix']);

export const HOST_PATTERNS = new Map([
    ['proxy_pass', /^https?:\/\/([A-Za-z][\w.-]*)/u],
    ['server', /^([A-Za-z][\w.-]*)/u],
]);

export const NGINX_ESCAPES = { t: '\t', r: '\r', n: '\n', '"': '"', "'": "'", '\\': '\\' } as const;

export const WORD_START_STOPS = /[\s"'{};#\\]/u;

export const WORD_STOPS = /[\s{};\\]/u;

export const NGINX_PUNCTUATION = new Set([';', '{', '}']);

/** A bare-word escape contains a backslash and its escaped character. */
export const ESCAPE_LENGTH = 2;

export const NGINX_FOLDER = '/etc/nginx';

export const ERROR_LOCATION = / in (?<file>\/[^\n]+):(?<line>\d+)\s*$/u;

export const OPENSSL_PROGRAM = 'openssl';

export const OPENSSL_KEY_FLAG = '-keyout';

export const OPENSSL_CERTIFICATE_FLAG = '-out';

export const ADD_HOST_FLAG = '--add-host';

export const VOLUME_FLAG = '-v';

export const NGINX_MAIN_TARGET = `${NGINX_FOLDER}/${NGINX_CONF}`;

export const CERTIFICATE_DIRECTIVES = {
    ssl_certificate_key: 'key',
    ssl_certificate: 'certificate',
    ssl_trusted_certificate: 'certificate',
} as const;

export const DOCKER_RUN_ARGUMENTS = ['run', '--rm'] as const;

export const LOOPBACK_ADDRESS = '127.0.0.1';

export const READ_ONLY_MOUNT = ':ro';

export const NGINX_TEST_COMMAND = ['nginx', '-T'] as const;

export const QUOTED_ARGUMENT = /^(["'])([\s\S]*)\1$/u;
export const ESCAPED_CHARACTER = /\\([trn"'\\])/gu;
