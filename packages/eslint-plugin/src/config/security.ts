// disabled-auto-escaping rule
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

// dynamic-templates rule
export const TEMPLATE_FUNCTIONS: ReadonlySet<string | undefined> = new Set([
    'pug.compile',
    'pug.render',
    'ejs.compile',
    'ejs.render',
]);

// no-code-eval rule
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

// no-dynamic-sql-queries rule
export const SQL_BUILDING_METHODS: ReadonlySet<string | null> = new Set(['concat', 'replace']);
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

// no-path-command rule
export const EXPLICIT_COMMAND = /^(?:\.[/\\]|\.\.|[/\\]|[A-Za-z]:\\)/u;
export const PATH_COMMAND_METHODS = new Set([
    'child_process.exec',
    'child_process.execSync',
    'child_process.execFile',
    'child_process.execFileSync',
    'child_process.spawn',
    'child_process.spawnSync',
]);

// no-public-file-permissions rule
export const CHMOD_METHODS: ReadonlySet<string> = new Set([
    'chmod',
    'chmodSync',
    'fchmod',
    'fchmodSync',
    'lchmod',
    'lchmodSync',
]);
export const FILE_MODE_CONSTANTS: Readonly<Record<string, number>> = {
    S_IRWXU: 0o700,
    S_IRUSR: 0o400,
    S_IWUSR: 0o200,
    S_IXUSR: 0o100,
    S_IRWXG: 0o70,
    S_IRGRP: 0o40,
    S_IWGRP: 0o20,
    S_IXGRP: 0o10,
    S_IRWXO: 0o7,
    S_IROTH: 0o4,
    S_IWOTH: 0o2,
    S_IXOTH: 0o1,
};
export const FILE_MODE_MODULE = 'fs.constants';
export const OTHERS_MASK = 0o7;
export const UMASK_FUNCTION = 'process.umask';

// no-public-temporary-path rule
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
export const TEMPORARY_ENVIRONMENT_VARIABLES = new Set(['TMPDIR', 'TMP', 'TEMPDIR', 'TEMP']);
export const WINDOWS_TEMPORARY_FOLDERS = new Set(['temp', 'tmp']);

// xml-parser-xxe rule
export const XML_PARSERS: ReadonlySet<string | undefined> = new Set([
    'libxmljs.parseXml',
    'libxmljs.parseXmlString',
    'libxmljs2.parseXml',
    'libxmljs2.parseXmlString',
]);
