import { CLEAN_SWIFT } from '#tests/data/checks/swift/lint.ts';
import { BASH_HEADER } from '#tests/data/checks/bash/samples.ts';
import { PROPERTY_READERS } from '#tests/data/checks/structure/environment-readers.ts';

export const BASH_TRIVIAL_FUNCTION_CASES = [
    {
        check: 'structure/trivial-functions',
        files: {
            'scripts/tiny.sh': `${BASH_HEADER}# _tiny: one line, one caller.
_tiny() {
    echo "$1"
}

# main: runs the script.
main() {
    _tiny "$1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/tiny.sh', rule: 'trivial-function', line: 9 },
    },
    {
        check: 'structure/trivial-functions',
        files: {
            'scripts/forward.sh': `${BASH_HEADER}# _forward: hands everything on.
_forward() {
    printf "$@"
}

# main: runs the script.
main() {
    _forward "$1"
    _forward "$1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/forward.sh', rule: 'trivial-function', line: 9 },
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
        source: PROPERTY_READERS,
        lines: [2, 4, 5, 8, 9],
    },
    { name: 'substantial function bodies', source: CLEAN_SWIFT, lines: [] },
] as const;

/** Interface code at a two-statement limit: the check reports each of its eight named functions, stubs included. */
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

export const TRIVIAL_FILES = [
    {
        name: 'a Python file of imports and aliases',
        language: 'python',
        file: 'example.py',
        source: `from other import value
alias = value
__all__ = ["alias"]
`,
        expected: true,
    },
    {
        name: 'a Python file with a wrapper function',
        language: 'python',
        file: 'example.py',
        source: `from other import alias
def wrapper():
    return alias()
`,
        expected: false,
    },
    {
        name: 'a Swift file of an import and a type alias',
        language: 'swift',
        file: 'example.swift',
        source: 'import Foundation\ntypealias Name = String\n',
        expected: true,
    },
    {
        name: 'a Swift file with a wrapper function',
        language: 'swift',
        file: 'example.swift',
        source: 'struct Wrapper { func value() { return original() } }',
        expected: false,
    },
    {
        name: 'a Bash file that only sources another script',
        language: 'bash',
        file: 'example.sh',
        source: 'source ./other.sh\n',
        expected: true,
    },
    {
        name: 'a Bash file with a wrapper function',
        language: 'bash',
        file: 'example.sh',
        source: 'source ./other.sh\nwrapper() { original; }',
        expected: false,
    },
    {
        name: 'an empty Python package file',
        language: 'python',
        file: '__init__.py',
        source: '',
        expected: false,
    },
    {
        name: 'a Python package marker comment',
        language: 'python',
        file: '__init__.py',
        source: '# Package marker\n',
        expected: false,
    },
    {
        name: 'a Python package with a marker comment and a docstring',
        language: 'python',
        file: '__init__.py',
        source: '# Package marker\n"""Package documentation."""\n',
        expected: false,
    },
    {
        name: 'a Python package docstring before an import',
        language: 'python',
        file: '__init__.py',
        source: '"""Package documentation."""\nfrom other import alias\n',
        expected: true,
    },
] as const;

/** Declarations, accessors, nested functions, and closures, each on its own line. */
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
