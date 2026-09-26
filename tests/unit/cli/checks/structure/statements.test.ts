import { expect, test } from 'bun:test';
import { policySchema } from '#cli/policy/schema.ts';
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import { functionsOf as swiftFunctions } from '#cli/checks/swift/sources.ts';
import { functionsOf as pythonFunctions } from '#cli/checks/python/modules.ts';
import { trivialFunctions as swiftTrivial } from '#cli/checks/swift/bodies.ts';
import { trivialFunctions as pythonTrivial } from '#cli/checks/python/functions.ts';
import { executableStatements, trivialFile } from '#cli/checks/structure/statements.ts';

for (const language of ['python', 'swift', 'bash'] as const) {
    test.each([0, 1, 2, 3])(`${language} counts %i executable statements`, async (count) => {
        const body = Array.from({ length: count }, () => (language === 'bash' ? 'echo value' : 'work()')).join(
            language === 'python' ? '\n    ' : '; ',
        );
        const source =
            language === 'python'
                ? `def example():\n    """Contract."""\n    ${body}\n`
                : language === 'swift'
                  ? `func example() { /* comment */ ${body} }`
                  : `example() { # comment\n${body}\n}`;
        const parser = await parserFor(language);
        const tree = parser.parse(source)!;
        try {
            const fn = tree.rootNode.descendantsOfType(
                language === 'swift' ? 'function_declaration' : 'function_definition',
            )[0]!;
            const nodes =
                language === 'python'
                    ? fn.childForFieldName('body')!.namedChildren.slice(1)
                    : fn.childForFieldName('body')!.namedChildren;
            expect(executableStatements(nodes, language)).toBe(count);
        } finally {
            tree.delete();
        }
    });
}

test('Python counts nested control flow and reports decorated methods and anonymous functions independently', async () => {
    const text =
        'class A:\n    @decorator\n    def method(self):\n        return 1\ndef outer():\n    def inner():\n        one()\n        two()\n        three()\n    return lambda x: x\ndef flow(x):\n    if x:\n        one()\n        two()\n';
    const tree = (await parserFor('python')).parse(text)!;
    try {
        const functions = pythonFunctions({
            path: 'example.py',
            tree,
            lines: text.split('\n'),
            statements: tree.rootNode.namedChildren,
        });
        expect(pythonTrivial(functions, 2).map((entry) => entry.line)).toStrictEqual([3, 5, 10]);
        expect(pythonTrivial(functions, 3).map((entry) => entry.line)).toStrictEqual([3, 5, 6, 10, 11]);
    } finally {
        tree.delete();
    }
});

test('Swift reports constructors, accessors, decorated methods, nested functions, and closures', async () => {
    const text =
        'class A { init() {}; var value: Int { get { return 1 } set { save(newValue) } }; @MainActor func method() { return }; func outer() { func inner() { one(); two(); three() }; let f = { x in x + 1 } } }';
    const tree = (await parserFor('swift')).parse(text)!;
    try {
        const functions = swiftFunctions({ path: 'example.swift', text, lines: [text], tree });
        expect(swiftTrivial(functions, 2)).toHaveLength(6);
        expect(swiftTrivial(functions, 3)).toHaveLength(7);
    } finally {
        tree.delete();
    }
});

test.each([0, -1, 1.5])('trivial statement threshold rejects %i', (threshold) => {
    expect(policySchema.safeParse({ version: 1, limits: { trivial_statements: threshold } }).success).toBe(false);
    expect(policySchema.safeParse({ version: 1, limits: { python: { trivial_statements: threshold } } }).success).toBe(
        false,
    );
});

test.each([
    ['', false],
    ['# Package marker\n', false],
    ['# Package marker\n"""Package documentation."""\n', false],
    ['"""Package documentation."""\nfrom other import alias\n', true],
    ['"""Package documentation."""\ndef wrapper():\n    return original()\n', true],
] as const)('Python package documentation does not hide structural code: %s', async (source, expected) => {
    const tree = (await parserFor('python')).parse(source)!;
    try {
        expect(trivialFile(tree.rootNode, 'python', 2)).toBe(expected);
    } finally {
        tree.delete();
    }
});

test.each([
    [
        'python',
        'from other import alias\ndef wrapper():\n    return alias()\n',
        'def owner():\n    one()\n    two()\n    three()\n',
    ],
    [
        'swift',
        'struct Wrapper { func value() { return original() } }',
        'struct Owner { func value() { one(); two(); three() } }',
    ],
    ['bash', 'source ./other.sh\nwrapper() { original; }', 'owner() { one; two; three; }'],
] as const)(
    '%s trivial files distinguish wrappers from substantial implementations',
    async (language, wrapper, owner) => {
        const parser = await parserFor(language);
        for (const [source, expected] of [
            [wrapper, true],
            [owner, false],
        ] as const) {
            const tree = parser.parse(source)!;
            try {
                expect(trivialFile(tree.rootNode, language, 2)).toBe(expected);
            } finally {
                tree.delete();
            }
        }
    },
);

test('Swift includes implicit getters, property observers, and subscript accessors', async () => {
    const text =
        'struct A { var x:Int { 1 }; var y = 0 { willSet { save(newValue) } didSet { save(oldValue) } }; subscript(i:Int)->Int { get { 1 } set { save(newValue) } } }';
    const tree = (await parserFor('swift')).parse(text)!;
    try {
        expect(swiftTrivial(swiftFunctions({ path: 'example.swift', text, lines: [text], tree }), 2)).toHaveLength(5);
    } finally {
        tree.delete();
    }
});
