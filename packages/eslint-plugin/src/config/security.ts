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

export const CIPHER_FUNCTION = 'crypto.createCipheriv';

export const WEAK_CIPHER_PREFIXES = ['bf', 'blowfish', 'des', 'rc2', 'rc4'] as const;

export const INSECURE_MODES = /CBC|ECB/iu;

export const MODELESS_CIPHERS: ReadonlySet<string> = new Set([
    'aes128',
    'aes192',
    'aes256',
    'bf',
    'blowfish',
    'camellia128',
    'camellia192',
    'camellia256',
    'cast',
    'des',
    'des-ede',
    'des-ede3',
    'des3',
    'desx',
    'rc2',
    'rc2-40',
    'rc2-64',
    'rc2-128',
    'seed',
]);

export const KEY_PAIR_SELECTOR =
    'CallExpression[callee.type="MemberExpression"][callee.property.name=/^generateKeyPair(?:Sync)?$/]';

export const MINIMUM_KEY_LENGTHS = { modulusLength: 2048, divisorLength: 224 } as const;

export const WEAK_CURVES: ReadonlySet<string> = new Set([
    'secp112r1',
    'secp112r2',
    'secp128r1',
    'secp128r2',
    'secp160k1',
    'secp160r1',
    'secp160r2',
    'secp192k1',
    'secp192r1',
    'prime192v2',
    'prime192v3',
    'sect113r1',
    'sect113r2',
    'sect131r1',
    'sect131r2',
    'sect163k1',
    'sect163r1',
    'sect163r2',
    'sect193r1',
    'sect193r2',
    'c2tnb191v1',
    'c2tnb191v2',
    'c2tnb191v3',
]);

export const TLS_OPTION_ARGUMENTS: Readonly<Record<string, readonly number[]>> = {
    'https.request': [0],
    'request.get': [0],
    'tls.connect': [2],
};

export const WEAK_SSL_OPTION_ARGUMENTS: Readonly<Record<string, readonly number[]>> = {
    'https.request': [0, 1],
    'request.get': [0],
    'tls.connect': [0, 1, 2],
    'tls.createSecureContext': [0],
};

export const WEAK_TLS_VERSIONS: ReadonlySet<unknown> = new Set(['TLSv1.1', 'TLSv1']);

export const TLS_VERSION_OPTIONS = ['minVersion', 'maxVersion'] as const;

export const SECURE_PROTOCOLS: ReadonlySet<unknown> = new Set([
    'TLSv1_2_method',
    'TLSv1_2_client_method',
    'TLSv1_2_server_method',
    'TLS_method',
    'TLS_client_method',
    'TLS_server_method',
]);

export const TLS_CONSTANTS_MODULES: ReadonlySet<string | undefined> = new Set(['constants', 'crypto.constants']);

export const REQUIRED_TLS_FLAGS = ['SSL_OP_NO_TLSv1', 'SSL_OP_NO_TLSv1_1'] as const;

export const JWT_FUNCTIONS = { sign: 'jsonwebtoken.sign', verify: 'jsonwebtoken.verify' } as const;

export const JWT_OPTIONS_ARGUMENT = 2;

export const NO_ALGORITHM = 'none';

export const SECRET_ARGUMENTS: Readonly<Record<string, readonly number[]>> = {
    'cookie-parser': [0],
    'cookie-parser.JSONCookie': [1],
    'cookie-parser.signedCookies': [1],
    'cookie-parser.signedCookie': [1],
    'crypto.X509Certificate.checkPrivateKey': [0],
    'crypto.createDiffieHellman.setPrivateKey': [0],
    'crypto.createECDH.setPrivateKey': [0],
    'crypto.createHmac': [1],
    'crypto.createSecretKey': [0],
    'crypto.createSign.sign': [0],
    'crypto.createVerify.verify': [0],
    'crypto.privateDecrypt': [0],
    'crypto.privateEncrypt': [0],
    'crypto.sign': [2],
    'crypto.verify': [2],
    'jose.SignJWT': [0],
    'jose.jwtVerify': [1],
    'jsonwebtoken.sign': [1],
    'jsonwebtoken.verify': [1],
    'ldapjs.createClient.bind': [1],
    'node-jose.JWK.asKey': [0],
    'superagent.auth': [0],
};

export const SECRET_PROPERTIES: Readonly<Record<string, string>> = {
    'cookie-session': 'keys',
    'express-session': 'secret',
    'typeorm.createConnection': 'password',
    'mysql.createConnection': 'password',
    'mysql.createPool': 'password',
    'mysql2.createConnection': 'password',
    'mysql2.createPool': 'password',
};

export const PLACEHOLDER_SECRET_LENGTH = 5;

export const PLACEHOLDER_SECRET = /(?:^\$\{)|example|sample|placeholder|test|fake|dummy|changeme|redacted/iu;

export const CHMOD_METHODS: ReadonlySet<string> = new Set([
    'chmod',
    'chmodSync',
    'fchmod',
    'fchmodSync',
    'lchmod',
    'lchmodSync',
]);

export const FILE_MODE_MODULE = 'fs.constants';

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

export const OCTAL_RADIX = 8;

export const OTHERS_MASK = 0o7;

export const UMASK_FUNCTION = 'process.umask';

export const ZERO_PREFIXED_OCTAL = /^0\d/u;

export const HASH_FUNCTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
    'crypto.createHash': new Set([
        'md2',
        'md4',
        'md5',
        'md6',
        'haval128',
        'hmacmd5',
        'dsa',
        'ripemd',
        'ripemd128',
        'ripemd160',
        'hmacripemd160',
        'sha1',
    ]),
    'crypto.subtle.digest': new Set(['sha-1']),
};

export const SUBTLE_DIGEST = 'crypto.subtle.digest';

export const DIGEST_METHOD = 'digest';

export const TRUNCATION_METHODS: ReadonlySet<string> = new Set(['slice', 'substring']);

export const WALLET_MODULES: ReadonlySet<unknown> = new Set(['ethers', 'viem/accounts', 'tronweb']);

export const MNEMONIC_FUNCTIONS: ReadonlySet<string | null> = new Set([
    'fromPhrase',
    'mnemonicToAccount',
    'fromMnemonic',
]);
