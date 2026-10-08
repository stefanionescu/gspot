// Trivy uses this configured exit code when an image report contains findings.
export const TRIVY_FINDINGS_EXIT = 10;

export const VALID_REPORT =
    '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"}]}]}';

export const MIXED_REPORT =
    '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"},{"VulnerabilityID":"CVE-neighbor","PkgName":"neighbor"}],"Secrets":[{"RuleID":"private-key","Title":"Private key","Secret":"sensitive-native-value"}]}]}';

export const CLEAN_REPORT = '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2"}';

export const COMPOSE_SOURCES = [
    { name: 'a quoted block mapping', source: 'services:\n  app:\n    image: "nginx:1.27.2"\n' },
    { name: 'an inline mapping', source: 'services: {app: {image: nginx:1.27.2}}\n' },
    { name: 'a folded value', source: 'services:\n  app:\n    image: >-\n      nginx:1.27.2\n' },
    {
        name: 'an inherited service mapping',
        source: 'x-base: &base\n  image: nginx:1.27.2\nservices:\n  app:\n    <<: *base\n',
    },
    {
        name: 'duplicate services with interpolation and unrelated images',
        source: 'x-example: {image: unrelated:1}\nservices: {app: {image: nginx:1.27.2}, copy: {image: nginx:1.27.2}, env: {image: "${IMAGE}"}, local: {build: .}}\n',
    },
];

export const REPORT_FAILURES = [
    {
        name: 'a fatal registry failure',
        code: 1,
        stdout: VALID_REPORT,
        stderr: 'FATAL registry authentication failed',
        diagnostic: 'Trivy could not scan nginx:1.27.2: FATAL registry authentication failed',
    },
    { name: 'an empty report', code: 0, stdout: '', stderr: '', diagnostic: 'JSON' },
    { name: 'malformed JSON', code: TRIVY_FINDINGS_EXIT, stdout: '{', stderr: '', diagnostic: 'JSON' },
    {
        name: 'a failing exit without findings',
        code: TRIVY_FINDINGS_EXIT,
        stdout: CLEAN_REPORT,
        stderr: '',
        diagnostic: 'Trivy returned an inconsistent image report for nginx:1.27.2.',
    },
    {
        name: 'a successful exit with vulnerabilities',
        code: 0,
        stdout: VALID_REPORT,
        stderr: '',
        diagnostic: 'Trivy returned an inconsistent image report for nginx:1.27.2.',
    },
    {
        name: 'a result without its target',
        code: TRIVY_FINDINGS_EXIT,
        stdout: '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{}]}',
        stderr: '',
        diagnostic: 'Target',
    },
];

export const INVALID_COMPOSE = [
    { name: 'malformed YAML', source: 'services: [' },
    { name: 'a non-string image', source: 'services: {app: {image: 12}}' },
    { name: 'an empty service value', source: 'services: {app: null}' },
];

export const DOCKERIGNORE_CASES = [
    { name: 'Docker alone', policy: 'configurations = ["docker"]\n', text: '.git\n.env\n', missing: '', scope: '' },
    {
        name: 'JavaScript',
        policy: 'configurations = ["docker", "javascript"]\n',
        text: '.git\n.env\n',
        missing: 'node_modules',
        scope: '',
    },
    {
        name: 'Python',
        policy: 'configurations = ["docker", "python"]\n',
        text: '.git\n.env\n',
        missing: '.venv',
        scope: '',
    },
    {
        name: 'native wildcard entries',
        policy: 'configurations = ["docker", "python", "javascript"]\n',
        text: '**/.git\n**/.env*\n**/node_modules\n**/.venv\n',
        missing: '',
        scope: '',
    },
    {
        name: 'a sibling language scope',
        policy: 'configurations = ["docker"]\n[scope.api]\nconfigurations = ["docker", "python"]\n[scope.web]\nconfigurations = ["javascript"]\n',
        text: '.git\n.env\n.venv\n',
        missing: '',
        scope: 'api',
    },
];
