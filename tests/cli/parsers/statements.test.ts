import { test, expect } from 'bun:test';
import { parseTestSource } from '#tests/harness/syntax.ts';
import { TRIVIAL_FILES } from '#tests/config/cli/parsers/statements.ts';
import { isTrivialFile, executableStatements } from '#cli/parsers/source/contracts.ts';

test.each([
    ['python', 'def example():\n    """Contract."""\n    work()\n    work()\n'],
    ['swift', 'func example() { /* comment */ work(); work() }'],
    ['bash', 'example() { # comment\necho value; echo value\n}'],
] as const)('%s counts two executable statements past comments and documentation', async (language, source) => {
    using tree = await parseTestSource(language, source);

    const fn = tree.rootNode.descendantsOfType(
        language === 'swift' ? 'function_declaration' : 'function_definition',
    )[0]!;
    const nodes =
        language === 'python'
            ? fn.childForFieldName('body')!.namedChildren.slice(1)
            : fn.childForFieldName('body')!.namedChildren;
    expect(executableStatements(nodes, language)).toBe(2);
});

test.each([
    ['', false],
    ['# Package marker\n', false],
    ['# Package marker\n"""Package documentation."""\n', false],
    ['"""Package documentation."""\nfrom other import alias\n', true],
    ['"""Package documentation."""\ndef wrapper():\n    return original()\n', true],
] as const)('Python package documentation does not hide structural code: %s', async (source, expected) => {
    using tree = await parseTestSource('python', source);

    expect(isTrivialFile(tree.rootNode, 'python', 2)).toBe(expected);
});

test.each([...TRIVIAL_FILES])('$name has trivial-file outcome $expected', async ({ language, source, expected }) => {
    using tree = await parseTestSource(language, source);
    expect(isTrivialFile(tree.rootNode, language, 2)).toBe(expected);
});
