export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

export const DOMAIN_SOURCE =
    'export const responseCount = 1, response = 1, responses = 1, category = 1;\n' +
    'export const algorithms = { SHA256: 1, BASE64: 1 };\n';

export const SCOPE_CEILINGS = [
    { scope: '', characters: 38, functions: 37, words: 4 },
    { scope: 'app', characters: 36, functions: 35, words: 3 },
    { scope: 'sibling', characters: 38, functions: 37, words: 4 },
];

export const TECHNICAL_NAMES = [
    'base64',
    'utf8',
    'sha256',
    'md5',
    'oauth2',
    'http2',
    'ipv4',
    'ipv6',
    'int32',
    's3Client',
    'k8s',
    'e2e',
    'i18n',
    'l10n',
    'a11y',
];

export const NAMING_LANGUAGES = ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'] as const;

export const NAMING_CATEGORIES = [
    'files',
    'directories',
    'types',
    'functions',
    'parameters',
    'variables',
    'properties',
    'classes',
    'methods',
    'constants',
    'attributes',
    'enum_cases',
    'tables',
    'columns',
];

/** Native case and length ownership leaves the other naming rules active. */
export const NATIVE_NAME_CATEGORIES = [
    { language: 'swift', category: 'types', native: true },
    { language: 'swift', category: 'variables', native: true },
    { language: 'swift', category: 'constants', native: true },
    { language: 'swift', category: 'functions', native: false },
    { language: 'swift', category: 'parameters', native: false },
    { language: 'swift', category: 'properties', native: false },
    { language: 'python', category: 'classes', native: true },
    { language: 'python', category: 'exceptions', native: true },
    { language: 'python', category: 'type_aliases', native: false },
    { language: 'python', category: 'variables', native: false },
];
