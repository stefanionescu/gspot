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

/** Postgres libraries retain their native JavaScript and Python manifest readers. */
export const POSTGRES_DEPENDENCY_CASES = [
    { name: 'pg', path: 'package.json', source: '{"private":true,"dependencies":{"pg":"8.16.3"}}\n' },
    { name: 'postgres', path: 'package.json', source: '{"private":true,"dependencies":{"postgres":"3.4.7"}}\n' },
    { name: 'psycopg', path: 'pyproject.toml', source: '[project]\ndependencies = ["psycopg>=3"]\n' },
    { name: 'asyncpg', path: 'pyproject.toml', source: '[project]\ndependencies = ["asyncpg>=0.31"]\n' },
    {
        name: '@neondatabase/serverless',
        path: 'package.json',
        source: '{"private":true,"dependencies":{"@neondatabase/serverless":"1.0.2"}}\n',
    },
];

/** Only the scoped Prisma schema's actual provider assignment supplies Postgres evidence. */
export const POSTGRES_CONTENT_CASES = [
    {
        name: 'Postgres provider',
        path: 'prisma/schema.prisma',
        source: 'datasource db {\n  provider = "postgresql"\n}\n',
        detected: true,
    },
    {
        name: 'SQLite provider',
        path: 'prisma/schema.prisma',
        source: 'datasource db {\n  provider = "sqlite"\n}\n',
        detected: false,
    },
    {
        name: 'MySQL provider',
        path: 'prisma/schema.prisma',
        source: 'datasource db {\n  provider = "mysql"\n}\n',
        detected: false,
    },
    {
        name: 'a commented provider',
        path: 'prisma/schema.prisma',
        source: '// provider = "postgresql"\n',
        detected: false,
    },
    { name: 'an unrelated text file', path: 'notes.txt', source: 'provider = "postgresql"\n', detected: false },
    { name: 'migrations without a provider', path: 'migrations/1_initial.sql', source: 'SELECT 1;\n', detected: false },
];
