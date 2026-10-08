/** Distinct native Python manifest forms retain their own input and expected dependency behavior. */
export const PYTHON_DEPENDENCY_CASES = [
    {
        name: 'PEP 621 table',
        path: 'pyproject.toml',
        source: '[project]\ndependencies = ["FastAPI>=1", "Friendly_Bard>=2"]\n',
    },
    {
        name: 'Poetry dependencies',
        path: 'pyproject.toml',
        source: '[tool.poetry.dependencies]\nFaStApI = "^1"\n"Friendly.Bard" = {version = "^2"}\npython = "^3.12"\n',
    },
    {
        name: 'Poetry web group',
        path: 'pyproject.toml',
        source: '[tool.poetry.group.web.dependencies]\nFASTAPI = {version = "^1", extras = ["standard"]}\n"Friendly...__Bard" = "^2"\n',
    },
    {
        name: 'requirements extras',
        path: 'requirements.txt',
        source: '# Not a dependency: django\nFastApi[standard]>=1 # web\nFriendly_Bard>=2\n--index-url https://example.com/simple\n-r other.txt\n',
    },
    {
        name: 'requirements direct address',
        path: 'requirements-dev.txt',
        source: 'FaStApI @ https://example.com/fastapi.whl\nFriendly.Bard==2\n',
    },
    {
        name: 'Pipfile packages',
        path: 'Pipfile',
        source: '[packages]\nfastAPI = {version = "*", extras = ["standard"]}\n"Friendly--Bard" = "==2"\n',
    },
];

/** Syntax, comments and strings have distinct Swift test-detection outcomes. */
export const SWIFT_TEST_CASES = [
    { name: 'XCTest import', source: 'import XCTest\n', selected: true },
    { name: 'qualified Testing attribute', source: '@Testing.Test func checks() {}\n', selected: true },
    { name: 'comment and string examples', source: '// import Testing\nlet example = "@Test"\n', selected: false },
    { name: 'TestingSupport import', source: 'import TestingSupport\n', selected: false },
];
/** Only the executable package target declares Swift tests. */
export const SWIFT_TARGET_CASES = [
    {
        name: 'an executable test target',
        source: 'import PackageDescription\nlet package = Package(name: "App", targets: [.testTarget(name: "Checks")])\n',
        declared: true,
    },
    {
        name: 'a comment and a string',
        source: '// .testTarget(name: "Checks")\nlet example = ".testTarget"\n',
        declared: false,
    },
];
