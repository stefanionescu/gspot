// ciphers
export const CIPHER_FUNCTION = 'crypto.createCipheriv';

// encryption-secure-mode rule
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

// hardcoded-secret-signatures rule
export const PLACEHOLDER_SECRET = /(?:^\$\{)|example|sample|placeholder|test|fake|dummy|changeme|redacted/iu;
export const PLACEHOLDER_SECRET_LENGTH = 5;
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

// insecure-jwt-token rule
export const JWT_FUNCTIONS = { sign: 'jsonwebtoken.sign', verify: 'jsonwebtoken.verify' } as const;
export const JWT_OPTIONS_ARGUMENT = 2;
export const NO_ALGORITHM = 'none';

// no-insecure-random rule
export const INSECURE_RANDOM_GENERATOR = 'Math.random';

// no-weak-cipher rule
export const WEAK_CIPHER_PREFIXES = ['bf', 'blowfish', 'des', 'rc2', 'rc4'] as const;

// no-weak-hashing rule
export const DIGEST_METHOD = 'digest';
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
export const TRUNCATION_METHODS: ReadonlySet<string> = new Set(['slice', 'substring']);

// no-weak-keys rule
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

// review-blockchain-mnemonic rule
export const MNEMONIC_FUNCTIONS: ReadonlySet<string | null> = new Set([
    'fromPhrase',
    'mnemonicToAccount',
    'fromMnemonic',
]);
export const WALLET_MODULES: ReadonlySet<unknown> = new Set(['ethers', 'viem/accounts', 'tronweb']);
