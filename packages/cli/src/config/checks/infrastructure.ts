import { PBXPROJ_FILE } from '#cli/config/files/names.ts';
import { GIT_FOLDER } from '#cli/config/repository/files.ts';

export const ANSIBLE_CONFIG_FILE = 'ansible.cfg';

export const ANSIBLE_CONFIG_EXTENSION = '.cfg';

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

export const DOCKER_RULES = { missingFile: 'missing-file', missingEntry: 'missing-entry', secret: 'secret' } as const;

export const SELF_REPOSITORY_MARKER = /^(\s*["']?)(\$|\\x24|\\u0024|\\U00000024)/u;

export const ACTION_FILES = ['action.yml', 'action.yaml'];

export const GITHUB_FOLDER = '.github/';

export const SELF_REFERENCE_PREFIX = '$/';

export const ENCODED_DOLLAR_SUFFIX = /24$/u;

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

export const ASSET_CONTENTS = 'Contents.json';

export const XCASSETS_FOLDER = '.xcassets/';

export const IMAGE_SET = `.imageset/${ASSET_CONTENTS}`;

export const PLIST_SUFFIX = '.plist';

export const ASSET_REFERENCE_ENDINGS = [
    '.swift',
    '.storyboard',
    '.xib',
    PLIST_SUFFIX,
    PBXPROJ_FILE,
    '.xcconfig',
] as const;

export const NAMED_SETS = [IMAGE_SET, `.colorset/${ASSET_CONTENTS}`] as const;

export const ASSET_KIND_SUFFIX = /(?:Color|Image)$/u;

export const WORD_SEPARATOR = /[^A-Za-z\d]/u;

export const XCSTRINGS_SUFFIX = '.xcstrings';

export const DEFAULT_SOURCE_LANGUAGE = 'en';

export const ENTITLEMENTS_SUFFIX = '.entitlements';

export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;

export const INSECURE_TRANSPORT_SETTING = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;

export const INSECURE_TRANSPORT_MESSAGE = 'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.';

export const UNTARGETED_FILE_MESSAGE = 'This Swift file is in no target of the project.';

export const EMPTY_SET_MESSAGE = 'This image set names no image file.';

export const XCODE_RULES = {
    unusedAsset: 'unused-asset',
    missingTranslation: 'missing-translation',
    entitlement: 'entitlement',
    arbitraryLoads: 'arbitrary-loads',
    untargeted: 'untargeted',
    emptySet: 'empty-set',
    missingImage: 'missing-image',
} as const;
