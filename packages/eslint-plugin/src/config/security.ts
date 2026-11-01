export const POWERED_BY_HEADER = 'x-powered-by';

export const POWERED_BY_SET_ARGUMENTS = 2;

export const POWERED_BY_FACTORIES = new Set(['express', 'express.default']);

export const POWERED_BY_MIDDLEWARE = new Set(['helmet', 'helmet.default', 'helmet.hidePoweredBy', 'hide-powered-by']);

export const INSECURE_RANDOM_GENERATOR = 'Math.random';

export const DISABLED_SECURITY_HEADERS = new Set(['contentSecurityPolicy', 'noSniff', 'referrerPolicy', 'hsts']);

export const UNSAFE_REFERRER_POLICIES = new Set(['', 'unsafe-url', 'no-referrer-when-downgrade']);

export const MINIMUM_HSTS_AGE = 15_552_000;

export const COOKIE_SECURITY_FLAGS = ['secure', 'httpOnly'] as const;

export const COOKIE_SET_OPTIONS_POSITION = 2;

export const PATH_COMMAND_METHODS = new Set(['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync']);
export const EXPLICIT_COMMAND_PREFIXES = ['./', '.\\', '..', '/', '\\', 'C:\\'];
export const PUBLIC_TEMPORARY_FOLDERS = [
    'tmp',
    'var/tmp',
    'usr/tmp',
    'dev/shm',
    'dev/mqueue',
    'run/lock',
    'var/run/lock',
    'library/caches',
    'users/shared',
    'private/tmp',
    'private/var/tmp',
];
export const WINDOWS_TEMPORARY_FOLDERS = new Set(['temp', 'tmp']);
export const TEMPORARY_ENVIRONMENT_VARIABLES = new Set(['TMPDIR', 'TMP', 'TEMPDIR', 'TEMP']);

export const SANITIZER_BYPASS_METHODS = new Set([
    'bypassSecurityTrustHtml',
    'bypassSecurityTrustStyle',
    'bypassSecurityTrustScript',
    'bypassSecurityTrustUrl',
    'bypassSecurityTrustResourceUrl',
]);

export const JSON_BODY_READ =
    'AwaitExpression[argument.type="CallExpression"][argument.arguments.length=0][argument.callee.type="MemberExpression"][argument.callee.property.name="json"][argument.callee.object.name=/^(?:req|request)$/]';

export const SCHEMA_PARSERS = new Set(['parse', 'safeParse', 'parseAsync', 'safeParseAsync']);

export const BODY_SCHEMA_PARSERS = new Set(['parse', 'safeParse']);
