// bare blocks
export const SWIFT_BARE_BLOCKS = `func report(_ value: Int) {
    do {
        print(value)
    }
    do {
        try check(value)
    } catch {
        print(error)
    }
}
do { print(1) }
`;
export const SWIFT_BLOCKS_FIXED = `func report(_ value: Int) {
    print(value)
    do {
        try check(value)
    } catch {
        print(error)
    }
}
print(1)
`;

// long files
export const LONG_JAVASCRIPT_FILE = 'export const values = [\n1,\n2,\n3\n];\n';
export const LONG_PYTHON_FILE = `VALUE_0 = 0
VALUE_1 = 1
VALUE_2 = 2
VALUE_3 = 3
VALUE_4 = 4
VALUE_5 = 5
VALUE_6 = 6
VALUE_7 = 7
VALUE_8 = 8
VALUE_9 = 9
VALUE_10 = 10
VALUE_11 = 11
VALUE_12 = 12`;

// trivial functions
export const ACCESSOR_DECLARATIONS = `class A {
    init() {}
    var value: Int {
        get { return 1 }
        set { save(newValue) }
    }
    @MainActor func method() { return }
    func outer() {
        func inner() { one(); two(); three() }
        let f = { x in x + 1 }
    }
}`;
export const CALLER_CASES = [
    {
        language: 'python',
        definition: 'shared.py',
        source: 'def total():\n    return 1\n',
        single: { 'first.py': 'from shared import total\n\nVALUE = total()\n' },
        shared: {
            'first.py': 'from shared import total\n\nVALUE = total()\n',
            'second.py': 'from shared import total\n\nOTHER = total() + 1\n',
        },
    },
    {
        language: 'swift',
        definition: 'Shared.swift',
        source: 'func total() -> Int {\n    return 1\n}\n',
        single: { 'First.swift': 'let value = total()\n' },
        shared: { 'First.swift': 'let value = total()\n', 'Second.swift': 'let other = total() + 1\n' },
    },
    {
        language: 'bash',
        definition: 'shared.sh',
        source: 'total() {\n  echo 1\n}\n',
        single: { 'run.sh': '. ./shared.sh\ntotal\n' },
        shared: { 'run.sh': '. ./shared.sh\ntotal\ntrap total EXIT\n' },
    },
] as const;
export const NESTED_PYTHON_FUNCTIONS = `class A:
    @decorator
    def method(self):
        return 1
def outer():
    def inner():
        one()
        two()
        three()
    return lambda x: x
def flow(x):
    if x:
        one()
        two()
HANDLERS = {"one": lambda: 1, "two": lambda: 2}
`;
export const PYTHON_INTERFACES = `from abc import ABC, abstractmethod
from typing import Protocol, overload

class Reader(Protocol):
    def read(self) -> bytes: ...

class Store(ABC):
    @abstractmethod
    def save(self) -> None:
        pass

class Sized:
    @property
    def size(self) -> int:
        return self._size
    @size.setter
    def size(self, value: int) -> None:
        self._size = value
    def hook(self) -> None:
        """Subclasses run their own code here."""
@overload
def parse(value: str) -> str: ...
@overload
def parse(value: int) -> int: ...
def parse(value):
    return value
`;
export const STATEMENT_COUNT_CASES = [
    [
        'python',
        `def example():
    """Contract."""
    work()
    work()
`,
    ],
    ['swift', 'func example() { /* comment */ work(); work() }'],
    ['bash', 'example() { # comment\necho value; echo value\n}'],
] as const;
const SWIFT_ACCESSORS = `struct A {
    var x: Int { 1 }
    var y = 0 {
        willSet { save(newValue) }
        didSet { save(oldValue) }
    }
    subscript(i: Int) -> Int {
        get { 1 }
        set { save(newValue) }
    }
}`;
export const TRIVIAL_FILES = [
    {
        name: 'a Python file of imports and aliases',
        language: 'python',
        file: 'example.py',
        source: `from other import value
alias = value
__all__ = ["alias"]
`,
        expected: ['trivial-file'],
    },
    {
        name: 'a Python file with a wrapper function',
        language: 'python',
        file: 'example.py',
        source: `from other import alias
def wrapper():
    return alias()
`,
        expected: ['trivial-function'],
    },
    {
        name: 'a Swift file of an import and a type alias',
        language: 'swift',
        file: 'example.swift',
        source: 'import Foundation\ntypealias Name = String\n',
        expected: ['trivial-file'],
    },
    {
        name: 'a Swift file with a wrapper function',
        language: 'swift',
        file: 'example.swift',
        source: 'struct Wrapper { func value() { return original() } }',
        expected: ['trivial-function'],
    },
    {
        name: 'a Bash file that only sources another script',
        language: 'bash',
        file: 'example.sh',
        source: 'source ./other.sh\n',
        expected: ['trivial-file'],
    },
    {
        name: 'a Bash file with a wrapper function',
        language: 'bash',
        file: 'example.sh',
        source: 'source ./other.sh\nwrapper() { original; }',
        expected: ['trivial-function'],
    },
    {
        name: 'a Python package with a marker comment and a docstring',
        language: 'python',
        file: '__init__.py',
        source: '# Package marker\n"""Package documentation."""\n',
        expected: [],
    },
    {
        name: 'a Python package docstring before an import',
        language: 'python',
        file: '__init__.py',
        source: '"""Package documentation."""\nfrom other import alias\n',
        expected: ['trivial-file'],
    },
] as const;
export const TRIVIAL_FUNCTION_CASES = [
    {
        name: 'switch expression',
        source: `import Foundation

private func label(_ count: Int) -> String {
    switch count {
    case 0:
        "none"
    case 1:
        "one"
    default:
        "many"
    }
}

/// The label of a pair.
func pairLabel() -> String {
    let text = label(2)
    return text + "!"
}
`,
        lines: [15],
    },
    {
        name: 'negated call',
        source: `import Foundation

/// Whether a name is new.
func isNew(_ name: String) -> Bool {
    !["a", "b"].contains(name)
}
`,
        lines: [4],
    },
    {
        name: 'implicit getters, property readers, and subscript accessors',
        source: SWIFT_ACCESSORS,
        lines: [2, 4, 5, 8, 9],
    },
    {
        name: 'closures in a dictionary literal',
        source: `import Foundation

let handlers: [String: () -> Int] = [
    "one": { 1 },
    "two": { 2 },
]
`,
        lines: [],
    },
] as const;
