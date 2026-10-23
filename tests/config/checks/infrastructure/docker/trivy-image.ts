export const TRIVY_MIXED_REPORT =
    '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"},{"VulnerabilityID":"CVE-neighbor","PkgName":"neighbor"}],"Secrets":[{"RuleID":"private-key","Title":"Private key","Secret":"sensitive-native-value"}]}]}';

export const COMPOSE_SOURCES = [
    {
        name: 'an inherited service mapping',
        source: `x-base: &base
  image: nginx:1.27.2
services:
  app:
    <<: *base
`,
    },
    {
        name: 'duplicate services with interpolation and unrelated images',
        source: `x-example: {image: unrelated:1}
services: {app: {image: nginx:1.27.2}, copy: {image: nginx:1.27.2}, env: {image: "\${IMAGE}"}, local: {build: .}}
`,
    },
] as const;

export const TRIVY_REPORT =
    '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"}]}]}';

export const TRIVY_REGISTRY_FAILURE = {
    code: 1,
    stdout: TRIVY_REPORT,
    stderr: 'FATAL registry authentication failed',
    message: 'Trivy could not scan nginx:1.27.2: FATAL registry authentication failed',
} as const;

export const INVALID_COMPOSE_SOURCES = [
    { name: 'malformed YAML', source: 'services: [', message: 'compose.yaml is not valid YAML:' },
    {
        name: 'a non-string image',
        source: 'services: {app: {image: 12}}',
        message: 'compose.yaml: services.app.image:',
    },
    { name: 'an empty service value', source: 'services: {app: null}', message: 'compose.yaml: services.app:' },
] as const;

export const TRIVY_IMAGE_FINDINGS = [
    {
        check: 'docker/trivy-image',
        help: 'Move to a newer tag of the image. Accept one advisory with `gspot ignore docker/trivy-image --rule <rule> --reason "<why>"`.',
        file: 'compose.yaml',
        line: 1,
        rule: 'CVE-example',
        message: 'nginx:1.27.2: CVE-example (example)',
        fixable: false,
    },
] as const;
