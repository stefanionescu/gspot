export const XML_PARSERS: ReadonlySet<string | undefined> = new Set([
    'libxmljs.parseXml',
    'libxmljs.parseXmlString',
    'libxmljs2.parseXml',
    'libxmljs2.parseXmlString',
]);

export const EVAL_FUNCTIONS: ReadonlySet<string | undefined> = new Set([
    'eval',
    'Function',
    'vm.Script',
    'vm.SourceTextModule',
    'vm.runInContext',
    'vm.runInNewContext',
    'vm.runInThisContext',
]);

export const SCRIPT_URL = /^javascript:/iu;

export const SQL_FUNCTIONS: ReadonlySet<string | undefined> = new Set([
    'pg.Client.query',
    'pg.Pool.query',
    'mysql.createConnection.query',
    'mysql.createPool.query',
    'mysql.createPoolCluster.query',
    'mysql2.createConnection.query',
    'mysql2.createPool.query',
    'mysql2.createPoolCluster.query',
    'sequelize.Sequelize.query',
    'sqlite3.Database.run',
    'sqlite3.Database.get',
    'sqlite3.Database.all',
    'sqlite3.Database.each',
    'sqlite3.Database.exec',
    'better-sqlite3.exec',
    'better-sqlite3.prepare',
    'mssql.ConnectionPool.query',
    'mssql.Request.query',
    'mssql.Request.batch',
    'mssql.Request.execute',
    'mysql2.createConnection.execute',
    'oracledb.getConnection.execute',
    'oracledb.getConnection.executeMany',
    'oracledb.getConnection.queryStream',
    'pg-promise.any',
    'pg-promise.each',
    'pg-promise.func',
    'pg-promise.many',
    'pg-promise.manyOrNone',
    'pg-promise.map',
    'pg-promise.multi',
    'pg-promise.multiResult',
    'pg-promise.none',
    'pg-promise.one',
    'pg-promise.oneOrNone',
    'pg-promise.proc',
    'pg-promise.query',
    'pg-promise.result',
    'knex.raw',
    'knex.whereRaw',
    'knex.havingRaw',
    'knex.groupByRaw',
    'knex.orderByRaw',
    'knex.joinRaw',
    'typeorm.createConnection.query',
    'typeorm.getConnection.query',
    'typeorm.getManager.query',
    'typeorm.getRepository.query',
]);

export const SQL_BUILDING_METHODS: ReadonlySet<string | null> = new Set(['concat', 'replace']);

export const TEMPLATE_FUNCTIONS: ReadonlySet<string | undefined> = new Set([
    'pug.compile',
    'pug.render',
    'ejs.compile',
    'ejs.render',
]);

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

export const EQUALITY_OPERATORS: ReadonlySet<string> = new Set(['==', '!=', '===', '!==']);

export const SESSION_MIDDLEWARES: ReadonlySet<string | undefined> = new Set(['express-session', 'cookie-session']);

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

export const ESCAPING_CALLS: Readonly<Record<string, { argument: number; property: string; value: boolean }>> = {
    'handlebars.compile': { argument: 1, property: 'noEscape', value: true },
    'marked.setOptions': { argument: 0, property: 'sanitize', value: false },
    'markdown-it': { argument: 0, property: 'html', value: true },
    'swig.setDefaults': { argument: 0, property: 'autoescape', value: false },
};

export const ESCAPING_CONSTRUCTIONS: Readonly<Record<string, { argument: number; property: string; value: boolean }>> =
    {
        'kramed.Renderer': { argument: 0, property: 'sanitize', value: false },
    };

export const MUSTACHE_ESCAPE = 'mustache.escape';

export const MUSTACHE_GLOBAL = 'Mustache';
