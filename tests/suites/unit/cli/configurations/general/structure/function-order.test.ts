import { writeFile } from 'node:fs/promises';

import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a private Python function below a public one is reported unless a function above calls it, and the moved function is not', async () => {
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
            line: 13,
            rule: 'private-below-public',
            message:
                'The private function _parse_row sits below the public function load_rows, and no function above it calls it. Move _parse_row above load_rows, or below a function that calls it.',
        },
    ]);
    await writeFile(
        `${sandbox.path}/rows.py`,
        `def _parse_row(line):
    return line.split(",")


def load_rows(text):
    return [_parse_row(line) for line in text.splitlines()]
`,
    );
    expect(await runSandboxCheck(sandbox.path, 'structure/function-order')).toStrictEqual([]);
});

test('a private or fileprivate Swift function below an internal one is reported unless a function above calls it, and methods are not', async () => {
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
        { file: 'Sources/Report.swift', line: 13, rule: 'private-below-public' },
    ]);
});

test('a private JavaScript or TypeScript function or function constant below an exported one is reported unless a function above calls it', async () => {
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
    ]);
    expect(findings[0]?.message).toMatch(/\blate\b.+\brun\b/u);
});

test('a run narrowed to one file reports only that file', async () => {
    const misplaced = `export function render(): string {
    return 'Rows';
}
function label(): string {
    return 'Rows';
}
export function title(): string {
    return label();
}
`;
    await using sandbox = await createGitSandbox({
        'src/rows.ts': misplaced,
        'src/view.ts': misplaced,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/function-order', { paths: ['src/view.ts'] });
    expect(findings.map(({ file, line }) => `${file}:${String(line)}`)).toStrictEqual(['src/view.ts:4']);
});
