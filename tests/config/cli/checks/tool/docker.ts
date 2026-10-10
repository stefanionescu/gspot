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

export const DOCKER_CONTEXT_CASES = [
    {
        name: 'a Dockerfile-specific ignore',
        files: { Dockerfile: 'FROM scratch\n', 'Dockerfile.dockerignore': '.git\n.env\n' },
        findings: [],
    },
    {
        name: 'a suffixed Dockerfile-specific ignore',
        files: { 'Dockerfile.test': 'FROM scratch\n', 'Dockerfile.test.dockerignore': '.git\n.env\n' },
        findings: [],
    },
    {
        name: 'a Compose build context with a nested Dockerfile',
        files: {
            'compose.yaml': 'services: {app: {build: {context: project, dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': '.git\n.env\n',
        },
        findings: [],
    },
    {
        name: 'a partial override retaining the same service context',
        files: {
            'compose.yaml': 'services: {app: {build: {context: project}}}\n',
            'compose.override.yaml': 'services: {app: {build: {dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': '.git\n.env\n',
        },
        findings: [],
    },
    {
        name: 'an unrelated ignored service beside a missing service ignore',
        files: {
            'compose.yaml': 'services: {affected: {build: {context: affected}}, other: {build: {context: other}}}\n',
            'compose.override.yaml': 'services: {affected: {build: {dockerfile: Dockerfile}}}\n',
            'affected/Dockerfile': 'FROM scratch\n',
            'other/Dockerfile': 'FROM scratch\n',
            'other/.dockerignore': '.git\n.env\n',
        },
        findings: [
            {
                file: 'affected/Dockerfile',
                rule: 'missing-file',
                message:
                    'Add an ignore file at affected/Dockerfile.dockerignore or affected/.dockerignore that lists .git, .env.',
            },
        ],
    },
    {
        name: 'a specific ignore taking precedence over the general ignore',
        files: { Dockerfile: 'FROM scratch\n', '.dockerignore': '.git\n.env\n', 'Dockerfile.dockerignore': '.git\n' },
        findings: [
            {
                file: 'Dockerfile.dockerignore',
                rule: 'missing-entry',
                message: 'Add these entries to Dockerfile.dockerignore: .env.',
            },
        ],
    },
    {
        name: 'a missing ignore with no alternative',
        files: { Dockerfile: 'FROM scratch\n' },
        findings: [
            {
                file: 'Dockerfile',
                rule: 'missing-file',
                message: 'Add an ignore file at Dockerfile.dockerignore or .dockerignore that lists .git, .env.',
            },
        ],
    },
];

export const DOCKER_HOST_VERSION = '29.0.0';

export const COMPOSE_PAIRING_CASES = [
    { base: 'compose.yaml', override: 'compose.override.yaml' },
    { base: 'compose.yml', override: 'compose.override.yml' },
    { base: 'docker-compose.yaml', override: 'docker-compose.override.yaml' },
    { base: 'docker-compose.yml', override: 'docker-compose.production.yml' },
];
