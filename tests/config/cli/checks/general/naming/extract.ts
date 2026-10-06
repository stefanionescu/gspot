export const SWIFT_EXTRACTOR_SOURCE = String.raw`import Foundation

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

export const PYTHON_EXTRACTOR_SOURCE = `"""Orders."""

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

export const TYPESCRIPT_EXTRACTOR_SOURCE = `
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

/** Declaration spellings grouped by each language's actual naming categories. */
export const TYPESCRIPT_NAMES = {
    functions: ['parseHttpUrl'],
    parameters: ['rawInput', 'retries', 'rest', 'first', 'second', 'event', 'baseUrl', 'body'],
    variables: ['enhancedHandler', 'payload', 'table'],
    classes: ['HttpClient'],
    properties: ['secret', 'DEFAULT_PORT', 'baseUrl', 'retries'],
    methods: ['send'],
    types: ['Options', 'Verdict', 'Mode'],
    enum_cases: ['Fast', 'Slow'],
};

export const PYTHON_NAMES = {
    constants: ['MAX_ITEMS'],
    variables: ['default_name', 'local_total'],
    type_aliases: ['OrderId'],
    exceptions: ['OrderError'],
    classes: ['Order_Book'],
    attributes: ['limit'],
    methods: ['__init__', 'addItem'],
    functions: ['make_order'],
    parameters: ['owner', 'verbatim', 'flags', 'item_name', 'count', 'name', 'size'],
};

export const SWIFT_NAMES = {
    types: ['Greeter', 'Mood', 'UserTemplate', 'Handler'],
    methods: ['greet', 'greet'],
    functions: ['top_level'],
    parameters: ['name', 'userName', 'id', 'value', 'label'],
    properties: ['maxCount', 'display_name', 'short'],
    variables: ['local_value'],
    constants: ['globalConstant'],
    enum_cases: ['happy', 'sad', 'veryAngry'],
};

export const SOURCE_ORDER_CASES = [
    {
        language: 'python',
        file: 'source.py',
        source: 'first_value = 1\ndef load_value(input_value):\n    inner_value = input_value\nclass Book:\n    pass\n',
        expected: ['first_value', 'load_value', 'input_value', 'inner_value', 'Book'],
    },
    {
        language: 'swift',
        file: 'source.swift',
        source: 'let firstValue = 1\nfunc loadValue(inputValue: Int) { let innerValue = inputValue }\nclass Book {}\n',
        expected: ['firstValue', 'loadValue', 'inputValue', 'innerValue', 'Book'],
    },
    {
        language: 'javascript',
        file: 'source.js',
        source: 'const firstValue = 1;\nfunction loadValue(inputValue) { const innerValue = inputValue; }\nclass Book {}\n',
        expected: ['firstValue', 'loadValue', 'inputValue', 'innerValue', 'Book'],
    },
    {
        language: 'bash',
        file: 'source.sh',
        source: 'first_value=1\nload_value() {\n    inner_value=1\n}\n',
        expected: ['first_value', 'load_value', 'inner_value'],
    },
];
