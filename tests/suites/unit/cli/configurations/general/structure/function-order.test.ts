import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    {
        name: 'a private function below the public function that calls it is reported',
        path: 'src/rows.ts',
        line: 5,
        message: 'Move parseRow above loadRows.',
        source: `export function loadRows(text: string): string[][] {
    return text.split(' ').map((line) => parseRow(line));
}

function parseRow(line: string): string[] {
    return line.split(',');
}
`,
        corrected: `function parseRow(line: string): string[] {
    return line.split(',');
}

export function loadRows(text: string): string[][] {
    return text.split(' ').map((line) => parseRow(line));
}
`,
    },
    {
        name: 'a helper below the first test of a test file is reported',
        path: 'tests/rows.test.ts',
        line: 7,
        message: 'Move splitRow above the first test.',
        source: `import { expect, test } from 'bun:test';

test.each([['a,b']])('a row splits at each comma', (line) => {
    expect(splitRow(line)).toHaveLength(2);
});

function splitRow(line: string): string[] {
    return line.split(',');
}
`,
        corrected: `import { expect, test } from 'bun:test';

function splitRow(line: string): string[] {
    return line.split(',');
}

test.each([['a,b']])('a row splits at each comma', (line) => {
    expect(splitRow(line)).toHaveLength(2);
});
`,
    },
])('$name', async ({ path, line, message, source, corrected }) => {
    await using sandbox = await createSandbox({
        configurations: ['typescript'],
        files: { 'package.json': '{"private":true}\n' },
    });
    await assertCheckSample(sandbox, {
        check: 'structure/function-order',
        files: { [path]: source },
        expected: {
            file: path,
            rule: 'private-below-public',
            line,
            message: expect.stringContaining(message) as string,
        },
        corrected: { files: { [path]: corrected } },
    });
});

test('a helper above the first test passes, and so does one below a test call in a source file', async () => {
    await using sandbox = await createGitSandbox({
        'tests/rows.test.ts': `import { describe, expect, it } from 'bun:test';

const splitRow = (line: string): string[] => line.split(',');

describe.skip('rows', () => {
    it('splits at each comma', () => {
        expect(splitRow('a,b')).toHaveLength(2);
    });
});
`,
        'src/report.ts': `describe('report');

function describe(title: string): void {
    console.log(title);
}
`,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/function-order')).toStrictEqual([]);
});

test('a private Python function below a public one is reported, and one above it and a dunder function are not', async () => {
    await using sandbox = await createGitSandbox({
        'rows.py': `def _strip(value):
    return value.strip()


def load_rows(text):
    return [_split_row(line) for line in text.splitlines()]


def _split_row(line):
    return _strip(line).split(",")


@cache
def _parse_row(line):
    return _strip(line).split(",")


def parse_rows(text):
    return [_parse_row(line) for line in text.splitlines()]


def __getattr__(name):
    raise AttributeError(name)
`,
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/function-order');
    expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        {
            line: 9,
            rule: 'private-below-public',
            message: expect.stringMatching(/\b_split_row\b.+\bload_rows\b/u) as string,
        },
        {
            line: 13,
            rule: 'private-below-public',
            message: expect.stringMatching(/\b_parse_row\b.+\bload_rows\b/u) as string,
        },
    ]);
});

test('a private or fileprivate Swift function below an internal one is reported, and methods are not', async () => {
    await using sandbox = await createGitSandbox({
        'Sources/Report.swift': String.raw`private func trim(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespaces)
}

func render(_ value: String) -> String {
    format(trim(value))
}

fileprivate func format(_ value: String) -> String {
    "[\(value)]"
}

fileprivate func quote(_ value: String) -> String {
    "\"\(value)\""
}

public func print(_ value: String) {
    Swift.print(render(quote(value)))
}

struct Report {
    func title() -> String { "Report" }

    private func subtitle() -> String { "Summary" }
}
`,
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/function-order');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Report.swift', line: 9, rule: 'private-below-public' },
        { file: 'Sources/Report.swift', line: 13, rule: 'private-below-public' },
    ]);
});

test('a private JavaScript or TypeScript function or function constant below an exported one is reported', async () => {
    await using sandbox = await createGitSandbox({
        'src/rows.ts': `function first(): number {
    return 1;
}
export const run = () => first();
const late = () => 2;
export default function main(): void {}
function* walk(): Generator<number> {}
export function listed(): void {}
function shared(): void {}
export { shared };
let helper = function (): void {};
export function over(value: string): string;
export function over(value: unknown): unknown {
    return value;
}
class Box {}
const value = 1;
`,
        'src/view.tsx': `export function View() {
    return <p>{label()}</p>;
}
function label(): string {
    return 'Rows';
}
`,
        'src/tool.mjs': `export default () => run();
async function run() {}
`,
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/function-order');
    expect(findings.map(({ file, line }) => `${file}:${String(line)}`)).toStrictEqual([
        'src/rows.ts:5',
        'src/rows.ts:7',
        'src/rows.ts:11',
        'src/tool.mjs:2',
        'src/view.tsx:4',
    ]);
    expect(findings[0]?.message).toMatch(/\blate\b.+\brun\b/u);
});
