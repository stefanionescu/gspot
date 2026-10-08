export const SCOPE_POLICY =
    'configurations = ["naming", "bash"]\n[naming]\nallowed = {remoteRecord = "The external JavaScript interface fixes this name."}\n[[naming.overrides]]\npaths = ["web/source.js"]\nallowed = ["remoteRecord"]\nreason = "The external JavaScript interface fixes this name."\n[scope."web"]\nconfigurations = ["javascript"]\n[scope."web".naming]\nallowed = {remoteRecord = "The external JavaScript interface fixes this name."}\n[scope."worker"]\nconfigurations = ["python"]\n[scope."worker".naming]\nallowed = {remote_record = "The external Python interface fixes this name."}\n';

export const TEST_PATH_POLICY =
    'level = "all"\nconfigurations = ["javascript", "swift", "naming"]\ntest_files = ["qa/**"]\n[scope."apps/web"]\ntest_files = ["verification/**"]\n[scope."apps/api"]\n';

export const TEST_PATH_FILES = {
    'qa/entry.js': 'export const testcaseCount = 1;\n',
    'tests/default.js': 'export const testcaseCount = 1;\n',
    'src/entry.js': 'export const testcaseCount = 1;\n',
    'Tests/Service.swift': 'let testcaseCount = 1\n',
    'Sources/ServiceTests.swift': 'let testcaseCount = 1\n',
    'Sources/Service.swift': 'let testcaseCount = 1\n',
    'apps/web/verification/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/qa/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/src/entry.js': 'export const testcaseCount = 1;\n',
    'apps/api/verification/entry.js': 'export const testcaseCount = 1;\n',
};

export const NAMING_LANGUAGES = ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'] as const;

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

export const DOMAIN_SOURCE =
    'export const responseCount = 1, response = 1, responses = 1, category = 1;\n' +
    'export const algorithms = { SHA256: 1, BASE64: 1 };\n';

export const SCOPE_CEILINGS = [
    { scope: '', characters: 38, functions: 37, words: 4 },
    { scope: 'app', characters: 36, functions: 35, words: 3 },
    { scope: 'sibling', characters: 38, functions: 37, words: 4 },
];

export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

export const ORDINARY_WORDS = ['data', 'message', 'values', 'id'];

export const RESERVED_POLICY =
    '[naming]\nreserved = {record = ["properties"]}\n' +
    '[scope."app"]\n[scope."app".naming]\nreserved = {record = ["functions"]}\n' +
    '[scope."sibling"]\n';

export const RESERVED_FILES = {
    'entry.ts': 'export const record = 1;\nexport type Row = { record: string };\n',
    'app/entry.ts': 'export function readRecord() { return 1; }\nexport type Row = { record: string };\n',
    'sibling/entry.ts': 'export const record = 1;\nexport type Row = { record: string };\n',
};

export const GROUP_SOURCE =
    'export const oldValue = 1;\nexport const fallback = 1;\nexport const plusValue = 1;\n' +
    'export const enhancedValue = 1;\nexport const ensureValue = 1;\n' +
    'export const custom = 1;\nexport const combined = 1;\n';

export const NUMBERED_FILES = {
    '.mise/tasks/01-build.sh': 'echo example\n',
    'scripts/steps/01-build.sh': 'echo example\n',
};

export const PREFIX_EXCEPTION =
    '[[naming.overrides]]\npaths = [".mise/tasks/*.sh", "scripts/steps/*.sh"]\n' +
    'categories = ["files"]\nignored_prefix = \'^\\d{2}-\'\nreason = "The project orders its tasks by this prefix."\n';

export const REPEATED_EXCEPTION =
    '[[naming.overrides]]\npaths = ["entry.ts"]\nnames = ["userUser"]\nallow_repeated_words = true\n' +
    'reason = "The generated interface fixes this exact repeated name."\n';

export const RESTORED_TERMS = [
    'taxonomy',
    'snapshot',
    'snapshots',
    'actual',
    'custom',
    'final',
    'latest',
    'old',
    'new',
    'legacy',
    'plus',
    'combined',
    'should',
    'transient',
    'fallback',
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

export const MIGRATION_NAMING_FILES = {
    'migrations/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
    'other/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
};
