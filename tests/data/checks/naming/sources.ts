const SWIFT_EXTRACTOR_SOURCE = String.raw`import Foundation

protocol Greeter { func greet(name: String) -> String }
enum Mood { case happy, sad; case veryAngry(level: Int) }
struct UserTemplate: Greeter {
    static let maxCount = 3
    var display_name: String
    func greet(name userName: String) -> String { let local_value = 1; return "\(local_value)" }
    init(id: Int) { self.display_name = "" }
}
typealias Handler = () -> Void
extension UserTemplate { var short: String { "" } }
func top_level(_ value: Int, with label: String) {}
let globalConstant = 1
`;

const PYTHON_EXTRACTOR_SOURCE = `"""Orders."""

MAX_ITEMS = 3
default_name = "x"

type OrderId = int


class OrderError(ValueError):
    """Raised for a bad order."""


class Order_Book:
    """Holds orders."""

    limit = 10

    def __init__(self, owner: str, *verbatim: int, **flags: bool) -> None:
        self.owner = owner

    def addItem(self, item_name: str = "a", count=1) -> None:
        local_total = count


def make_order(name, /, size: int) -> None:
    """Make one."""
`;

const TYPESCRIPT_EXTRACTOR_SOURCE = `
export function parseHttpUrl(rawInput: string, { retries = 3, ...rest }: Options, [first, second]: string[]): void {}
const enhancedHandler = (event) => {};
let { data: payload } = source;
class HttpClient extends Base {
    #secret = 1;
    static readonly DEFAULT_PORT = 80;
    constructor(private readonly baseUrl: string) {}
    async send(body: Body): Promise<void> {}
}
interface Options { retries?: number; 'Content-Type': string }
type Verdict = 'ok';
enum Mode { Fast, Slow = 2 }
const table = { keyOne: 1 };
`;

/** Declared names, grouped by the naming categories of each language. */
const EXPECTED_TYPESCRIPT_NAMES = {
    functions: ['parseHttpUrl'],
    parameters: ['rawInput', 'rest', 'first', 'second', 'event', 'baseUrl', 'body'],
    variables: ['enhancedHandler', 'payload', 'table'],
    classes: ['HttpClient'],
    properties: ['secret', 'DEFAULT_PORT', 'baseUrl', 'retries'],
    methods: ['send'],
    types: ['Options', 'Verdict', 'Mode'],
    enum_cases: ['Fast', 'Slow'],
} as const;

const EXPECTED_PYTHON_NAMES = {
    constants: ['MAX_ITEMS'],
    variables: ['default_name', 'local_total'],
    type_aliases: ['OrderId'],
    exceptions: ['OrderError'],
    classes: ['Order_Book'],
    attributes: ['limit'],
    methods: ['__init__', 'addItem'],
    functions: ['make_order'],
    parameters: ['owner', 'verbatim', 'flags', 'item_name', 'count', 'name', 'size'],
} as const;

const EXPECTED_SWIFT_NAMES = {
    types: ['Greeter', 'Mood', 'UserTemplate', 'Handler'],
    methods: ['greet', 'greet'],
    functions: ['top_level'],
    parameters: ['name', 'userName', 'id', 'value', 'label'],
    properties: ['maxCount', 'display_name', 'short'],
    variables: ['local_value'],
    constants: ['globalConstant'],
    enum_cases: ['happy', 'sad', 'veryAngry'],
} as const;

const NEXT_PAGE_SOURCE = 'export default function Page() { return null; }\n';

export const DECLARATION_ORDER_CASES = [
    {
        language: 'python',
        file: 'source.py',
        source: `first_value = 1
def load_value(input_value):
    inner_value = input_value
class Book:
    pass
`,
        expected: ['first_value', 'load_value', 'input_value', 'inner_value', 'Book'],
    },
    {
        language: 'swift',
        file: 'source.swift',
        source: `let firstValue = 1
func loadValue(inputValue: Int) { let innerValue = inputValue }
class Book {}
`,
        expected: ['firstValue', 'loadValue', 'inputValue', 'innerValue', 'Book'],
    },
    {
        language: 'javascript',
        file: 'source.js',
        source: `const firstValue = 1;
function loadValue(inputValue) { const innerValue = inputValue; }
class Book {}
`,
        expected: ['firstValue', 'loadValue', 'inputValue', 'innerValue', 'Book'],
    },
    {
        language: 'bash',
        file: 'source.sh',
        source: `first_value=1
load_value() {
    inner_value=1
}
`,
        expected: ['first_value', 'load_value', 'inner_value'],
    },
] as const;

export const NAME_POSITION_CASES = [
    {
        file: 'source.py',
        language: 'python',
        source: '_ = 1\nvalue_name = 2\n',
        expected: [{ name: 'value_name', category: 'variables', line: 2, column: 1 }],
    },
    {
        file: 'source.sh',
        language: 'bash',
        source: '_=1\nvalue_name=2\n',
        expected: [{ name: 'value_name', category: 'variables', line: 2, column: 1 }],
    },
    {
        file: 'source.ts',
        language: 'typescript',
        source: 'const _ = 1;\nclass Book { #value = 1; ["computed"] = 2; }\n',
        expected: [
            { name: 'Book', category: 'classes', line: 2, column: 7 },
            { name: 'value', category: 'properties', line: 2, column: 14 },
        ],
    },
    {
        file: 'source.swift',
        language: 'swift',
        source: `let \`class\` = 1
let _ = 2
func \`repeat\`(\`default\`: Int) {}
`,
        expected: [
            { name: 'class', category: 'constants', line: 1, column: 5 },
            { name: 'repeat', category: 'functions', line: 3, column: 6 },
            { name: 'default', category: 'parameters', line: 3, column: 15 },
        ],
    },
] as const;

export const MIGRATION_FILES = {
    'migrations/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
    'other/20240101000000_create_teams/query.sql': 'SELECT 1;\n',
} as const;

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
} as const;

export const NUMBERED_FILES = {
    '.mise/tasks/01-build.sh': 'echo example\n',
    'scripts/steps/01-build.sh': 'echo example\n',
} as const;

/** One sample per parser, the names it declares by category, and names it must leave out. */
export const DECLARATION_SAMPLES = [
    {
        language: 'typescript',
        path: 'src/a.ts',
        source: TYPESCRIPT_EXTRACTOR_SOURCE,
        expected: EXPECTED_TYPESCRIPT_NAMES,
        absent: ['keyOne'],
    },
    {
        language: 'python',
        path: 'shop/orders.py',
        source: PYTHON_EXTRACTOR_SOURCE,
        expected: EXPECTED_PYTHON_NAMES,
        absent: ['self'],
    },
    {
        language: 'swift',
        path: 'Sources/User.swift',
        source: SWIFT_EXTRACTOR_SOURCE,
        expected: EXPECTED_SWIFT_NAMES,
        absent: [],
    },
] as const;

/** File names that naming/paths reports, the names it allows beside them, and the rename that fixes each. */
export const FILE_NAME_CASES = [
    {
        name: '__init__.ts is reported; Python __init__.py and __main__.py are allowed',
        configurations: ['python', 'typescript', 'naming'],
        files: {
            'python/__init__.py': '"""Package entry."""\n',
            'python/__main__.py': '"""Program entry."""\n',
            'javascript/__init__.ts': 'export const entry = 1;\n',
        },
        invalid: 'javascript/__init__.ts',
        renamed: 'javascript/entry.ts',
    },
    {
        name: 'a SQL migration file name keeps its timestamp and must be snake case',
        configurations: ['sql', 'naming'],
        files: {
            'migrations/20260101120000_CreateUsers.sql': 'CREATE TABLE users (id integer);\n',
            'queries/select_users.sql': 'SELECT id FROM users;\n',
        },
        invalid: 'migrations/20260101120000_CreateUsers.sql',
        renamed: 'migrations/20260101120000_create_users.sql',
    },
    {
        name: 'Next.js special pages such as _app and 404 are allowed; a snake_case page is reported',
        configurations: ['nextjs', 'naming'],
        files: {
            'pages/_app.tsx': NEXT_PAGE_SOURCE,
            'pages/_document.tsx': NEXT_PAGE_SOURCE,
            'pages/_error.tsx': NEXT_PAGE_SOURCE,
            'pages/404.tsx': NEXT_PAGE_SOURCE,
            'pages/500.tsx': NEXT_PAGE_SOURCE,
            'pages/about_page.ts': 'export const title = "About";\n',
        },
        invalid: 'pages/about_page.ts',
        renamed: 'pages/about-page.ts',
    },
    {
        name: 'files in dot folders still get file-name checks',
        configurations: ['typescript', 'naming'],
        files: {
            '.archive/bad_name.ts': 'export const entry = 1;\n',
            '.claude/entry.ts': 'export const entry = 1;\n',
            '.vscode/entry.ts': 'export const entry = 1;\n',
        },
        invalid: '.archive/bad_name.ts',
        renamed: '.archive/bad-name.ts',
    },
] as const;
