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
        source: `[tool.poetry.dependencies]
FaStApI = "^1"
"Friendly.Bard" = {version = "^2"}
python = "^3.12"
`,
    },
    {
        name: 'Poetry web group',
        path: 'pyproject.toml',
        source: `[tool.poetry.group.web.dependencies]
FASTAPI = {version = "^1", extras = ["standard"]}
"Friendly...__Bard" = "^2"
`,
    },
    {
        name: 'requirements extras',
        path: 'requirements.txt',
        source: `# Not a dependency: django
FastApi[standard]>=1 # web
Friendly_Bard>=2
--index-url https://example.com/simple
-r other.txt
`,
    },
    {
        name: 'requirements direct address',
        path: 'requirements-dev.txt',
        source: 'FaStApI @ https://example.com/fastapi.whl\nFriendly.Bard==2\n',
    },
    {
        name: 'Pipfile packages',
        path: 'Pipfile',
        source: `[packages]
fastAPI = {version = "*", extras = ["standard"]}
"Friendly--Bard" = "==2"
`,
    },
] as const;

/** Syntax, comments and strings have distinct Swift test-detection outcomes. */
export const SWIFT_TEST_CASES = [
    { name: 'XCTest import', source: 'import XCTest\n', selected: true },
    { name: 'qualified Testing attribute', source: '@Testing.Test func checks() {}\n', selected: true },
    { name: 'comment and string examples', source: '// import Testing\nlet example = "@Test"\n', selected: false },
    { name: 'TestingSupport import', source: 'import TestingSupport\n', selected: false },
] as const;

/** Only the executable package target declares Swift tests. */
export const SWIFT_TARGET_CASES = [
    {
        name: 'an executable test target',
        source: `import PackageDescription
let package = Package(name: "App", targets: [.testTarget(name: "Checks")])
`,
        declared: true,
    },
    {
        name: 'a comment and a string',
        source: '// .testTarget(name: "Checks")\nlet example = ".testTarget"\n',
        declared: false,
    },
] as const;

/** Only the scoped Prisma schema's actual provider assignment supplies Postgres evidence. */
export const PRISMA_CONTENT_CASES = [
    {
        name: 'Postgres provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "postgresql"
}
`,
        detected: true,
    },
    {
        name: 'SQLite provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "sqlite"
}
`,
        detected: false,
    },
    {
        name: 'MySQL provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "mysql"
}
`,
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
] as const;
