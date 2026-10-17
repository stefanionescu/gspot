import { BASH_HEADER } from '#tests/data/checks/bash/samples.ts';

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
        line: 15,
        trivialFile: false,
    },
    {
        name: 'negated call',
        source: `import Foundation

/// Whether a name is new.
func isNew(_ name: String) -> Bool {
    !["a", "b"].contains(name)
}
`,
        line: 4,
        trivialFile: true,
    },
] as const;

export const TRIVIAL_FILES = [
    {
        name: 'a Python forwarding wrapper',
        language: 'python',
        source: `from other import alias
def wrapper():
    return alias()
`,
        expected: true,
    },
    {
        name: 'a Python implementation with three statements',
        language: 'python',
        source: `def owner():
    one()
    two()
    three()
`,
        expected: false,
    },
    {
        name: 'a Swift forwarding wrapper',
        language: 'swift',
        source: 'struct Wrapper { func value() { return original() } }',
        expected: true,
    },
    {
        name: 'a Swift implementation with three statements',
        language: 'swift',
        source: 'struct Owner { func value() { one(); two(); three() } }',
        expected: false,
    },
    {
        name: 'a Bash forwarding wrapper',
        language: 'bash',
        source: 'source ./other.sh\nwrapper() { original; }',
        expected: true,
    },
    {
        name: 'a Bash implementation with three statements',
        language: 'bash',
        source: 'owner() { one; two; three; }',
        expected: false,
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

export const SWIFT_FUNCTION_LIMITS = '[limits.swift]\ntrivial_function_statements = 2\n';

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

export const PACKAGE_DOCSTRING_CASES = [
    ['', false],
    ['# Package marker\n', false],
    ['# Package marker\n"""Package documentation."""\n', false],
    ['"""Package documentation."""\nfrom other import alias\n', true],
    [
        `"""Package documentation."""
def wrapper():
    return original()
`,
        true,
    ],
] as const;
