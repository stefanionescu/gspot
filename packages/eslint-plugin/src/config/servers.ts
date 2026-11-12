export const CSRF_MODULE = 'csurf';

export const CSRF_SAFE_METHODS: ReadonlySet<unknown> = new Set(['GET', 'HEAD', 'OPTIONS']);

export const CSRF_CHANGING_METHODS: ReadonlySet<string | null> = new Set(['post', 'put', 'delete', 'patch']);

export const MIDDLEWARE_METHOD = 'use';

export const MIDDLEWARE_SELECTOR =
    'CallExpression[arguments.length>0][callee.type="MemberExpression"][callee.property.name="use"]';

export const DEBUG_MIDDLEWARE = 'errorhandler';

export const SERVER_FUNCTION = 'http.createServer';

export const CROSS_ORIGIN_MODULE = 'cors';

export const ALLOW_ORIGIN_HEADER = 'access-control-allow-origin';

export const EXPRESS_MODULE = 'express';

export const EXPRESS_ROUTE_METHODS: ReadonlySet<string | undefined> = new Set([
    'all',
    'checkout',
    'copy',
    'delete',
    'get',
    'head',
    'lock',
    'merge',
    'mkactivity',
    'mkcol',
    'move',
    'm-search',
    'notify',
    'options',
    'patch',
    'post',
    'purge',
    'put',
    'report',
    'search',
    'subscribe',
    'trace',
    'unlock',
    'unsubscribe',
]);

export const RESPONSE_CALL_ARGUMENTS = 2;

export const COOKIE_SESSION_MODULE = 'cookie-session';

export const SESSION_MIDDLEWARES: ReadonlySet<string | undefined> = new Set(['express-session', COOKIE_SESSION_MODULE]);

export const STATIC_MIDDLEWARE = 'express.static';

export const INJECTED_APPLICATION = 'app';

export const AUTHENTICATE_FUNCTION = 'passport.authenticate';

export const REGENERATE_METHOD = 'regenerate';

export const ROUTE_CALLBACK_POSITION = 2;

export const FORMIDABLE_MODULE = 'formidable';

export const MULTER_MODULE = 'multer';

export const BODY_PARSER_MODULE = 'body-parser';

export const UPLOAD_MESSAGES: Readonly<Record<string, 'folder' | 'extension' | 'extensionAndFolder'>> = {
    'false,false': 'folder',
    'false,true': 'extensionAndFolder',
    'true,true': 'extension',
};

export const SIZE_LIMITS = { upload: 8_000_000, standard: 2_000_000 } as const;

export const SIZE_DEFAULTS = { formidable: 200 * 1024 * 1024 } as const;

export const SIZE_UNITS: Readonly<Record<string, number>> = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
    pb: 1024 ** 5,
};

export const SIZE_TEXT = /^(?<amount>[+-]?\d+(?:\.\d+)?) *(?<unit>[kmgtp]?b)?$/iu;

export const BODY_LIMIT_OPTIONS = ['limit', 'limits'] as const;

export const POWERED_BY_HEADER = 'x-powered-by';

export const POWERED_BY_SET_ARGUMENTS = 2;

export const POWERED_BY_FACTORIES = new Set(['express', 'express.default']);

export const POWERED_BY_MIDDLEWARE = new Set(['helmet', 'helmet.default', 'helmet.hidePoweredBy', 'hide-powered-by']);

export const DISABLED_SECURITY_HEADERS = new Set(['contentSecurityPolicy', 'noSniff', 'referrerPolicy', 'hsts']);

export const UNSAFE_REFERRER_POLICIES = new Set(['', 'unsafe-url', 'no-referrer-when-downgrade']);

export const MINIMUM_HSTS_AGE = 15_552_000;

export const COOKIE_SECURITY_FLAGS = ['secure', 'httpOnly'] as const;

export const COOKIE_SET_OPTIONS_POSITION = 2;

export const JSON_BODY_READ =
    'AwaitExpression[argument.type="CallExpression"][argument.arguments.length=0][argument.callee.type="MemberExpression"][argument.callee.property.name="json"][argument.callee.object.name=/^(?:req|request)$/]';

export const SCHEMA_PARSERS = new Set(['parse', 'safeParse', 'parseAsync', 'safeParseAsync']);

export const BODY_SCHEMA_PARSERS = new Set(['parse', 'safeParse']);

export const REQUEST_NAMES: ReadonlySet<string> = new Set(['req', 'request']);

export const REQUEST_FIELDS: ReadonlySet<string> = new Set([
    'query',
    'body',
    'params',
    'headers',
    'cookies',
    'signedCookies',
]);

export const REQUEST_READERS: ReadonlySet<string> = new Set(['get', 'header', 'param']);

export const RESPONSE_NAMES: ReadonlySet<string> = new Set(['res', 'response']);

export const NUMBER_CONVERTERS: ReadonlySet<string> = new Set(['Number', 'parseInt', 'parseFloat', 'Boolean']);

export const RESPONSE_TARGETS: Readonly<Record<string, 'redirect' | 'html' | 'template' | 'path'>> = {
    redirect: 'redirect',
    send: 'html',
    write: 'html',
    end: 'html',
    render: 'template',
    sendFile: 'path',
    download: 'path',
};

export const SQL_METHODS: ReadonlySet<string> = new Set([
    'query',
    'execute',
    'raw',
    '$queryRawUnsafe',
    '$executeRawUnsafe',
]);

export const FILE_FUNCTION = /^fs(?:\.promises)?\.(?<method>[A-Za-z]+?)(?:Sync)?$/u;

export const FILE_METHODS: ReadonlySet<string> = new Set([
    'readFile',
    'writeFile',
    'appendFile',
    'createReadStream',
    'createWriteStream',
    'open',
    'unlink',
    'rm',
    'rmdir',
    'readdir',
    'stat',
    'lstat',
    'access',
    'copyFile',
    'rename',
    'mkdir',
]);

export const OUTBOUND_FUNCTIONS: ReadonlySet<string> = new Set([
    'fetch',
    'node-fetch',
    'undici.fetch',
    'undici.request',
    'axios',
    'axios.get',
    'axios.post',
    'axios.put',
    'axios.patch',
    'axios.delete',
    'axios.head',
    'axios.request',
    'got',
    'got.get',
    'got.post',
    'got.put',
    'got.patch',
    'got.delete',
    'got.head',
    'http.get',
    'http.request',
    'https.get',
    'https.request',
]);

export const COMMAND_FUNCTION = /^child_process\.(?:spawn|spawnSync|execFile|execFileSync)$/u;

export const COMMAND_INTERPRETERS: ReadonlySet<unknown> = new Set([
    'sh',
    'bash',
    'zsh',
    '/bin/sh',
    '/bin/bash',
    'cmd',
    'cmd.exe',
]);
