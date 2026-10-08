export const POLICY = `configurations = ["bash", "swift", "structure"]
[agent_rules]
enabled = false
[limits.bash]
file_lines = 100
[swift]
xcode_scheme = "5.0"
[tools.swiftlint]
keep_imports = ["Foundation"]
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/**"]
reason = "The api scripts pass word lists on purpose."
[scope."api"]
configurations = ["bash"]
[scope."api".limits.bash]
file_lines = 80
[scope."api".swift]
xcode_scheme = "6.0"
[scope."api".tools.swiftlint]
keep_imports = ["UIKit"]
[scope."api/v1"]
configurations = ["bash"]
[scope."api/v1".limits.bash]
file_lines = 60
[scope."api/v1".swift]
xcode_scheme = "5.0"
[scope."api/v1".tools.swiftlint]
keep_imports = ["SwiftUI"]
[scope."web"]
configurations = ["bash"]
`;

export const OPENAPI_DOCUMENTS = ['openapi.yaml', 'openapi.yml', 'openapi.json', 'swagger.json', 'swagger.yaml'];

export const OPENAPI_PATH_CASES = [
    { name: 'detected', root: '', child: '', expected: ['openapi.yaml', 'api/swagger.yaml'] },
    {
        name: 'authored root',
        root: '[openapi]\ndocument = "openapi.yaml"\n',
        child: '',
        expected: ['openapi.yaml', 'openapi.yaml'],
    },
    {
        name: 'authored child',
        root: '[openapi]\ndocument = "openapi.yaml"\n',
        child: '[scope.api.openapi]\ndocument = "swagger.yaml"\n',
        expected: ['openapi.yaml', 'api/swagger.yaml'],
    },
    { name: 'disabled root', root: '[openapi]\ndocument = ""\n', child: '', expected: ['', ''] },
    { name: 'disabled child', root: '', child: '[scope.api.openapi]\ndocument = ""\n', expected: ['openapi.yaml', ''] },
];
