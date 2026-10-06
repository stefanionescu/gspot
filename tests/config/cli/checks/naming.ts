export const SCOPE_POLICY =
    'configurations = ["naming", "bash"]\n[naming]\nallowed = [{name = "remoteRecord", reason = "The external JavaScript interface fixes this name."}]\n[[naming.paths]]\npaths = ["web/source.js"]\nnames = ["remoteRecord"]\nskip = true\nreason = "The external JavaScript interface fixes this name."\n[[scope]]\npath = "web"\nconfigurations = ["javascript"]\n[scope.naming]\nallowed = [{name = "remoteRecord", reason = "The external JavaScript interface fixes this name."}]\n[[scope]]\npath = "worker"\nconfigurations = ["python"]\n[scope.naming]\nallowed = [{name = "remote_record", reason = "The external Python interface fixes this name."}]\n';

export const TEST_PATH_POLICY =
    'level = "all"\nconfigurations = ["javascript", "swift", "naming"]\ntests = ["qa/**"]\n[[scope]]\npath = "apps/web"\ntests = ["verification/**"]\n[[scope]]\npath = "apps/api"\n';

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

export const LANGUAGE_CEILINGS = [
    { language: 'typescript', characters: 35, words: 4 },
    { language: 'javascript', characters: 35, words: 4 },
    { language: 'python', characters: 35, words: 4 },
    { language: 'swift', characters: 40, words: 5 },
    { language: 'bash', characters: 35, words: 4 },
    { language: 'sql', characters: 55, words: 7 },
] as const;

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
    'export const actualCount = 1, snapshot = 1, snapshots = 1, taxonomy = 1;\n' +
    'export const algorithms = { SHA256: 1, BASE64: 1 };\n';

export const SCOPE_CEILINGS = [
    { scope: '', characters: 38, functions: 37, words: 4 },
    { scope: 'app', characters: 36, functions: 35, words: 3 },
    { scope: 'sibling', characters: 38, functions: 37, words: 4 },
];

export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
