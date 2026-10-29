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

export const NGINX_KEY_FILE = 'key.pem';

export const NGINX_CERTIFICATE_FILE = 'certificate.pem';

export const NGINX_COPY_PREFIX = 'copy-';

export const NGINX_DUMP_FILE_LINE = /^# configuration file (?<path>[^\n]+):$/gmu;

export const NGINX_EMERGENCY_MARK = '[emerg]';

export const NGINX_VARIABLE_MARK = '$';

export const NGINX_TABLE = 'tools.nginx';

export const DOCKER_DAEMON_ERROR = /cannot connect to the docker daemon/iu;
export const DOCKER_DAEMON_NOTE = 'Start Docker: nginx/syntax runs nginx -T in a container.';
