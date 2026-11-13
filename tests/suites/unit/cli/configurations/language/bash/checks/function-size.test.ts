import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { BASH_SIZE_CASES, COUNTED_LOOPS } from '#tests/config/configurations/bash.ts';
import { BASH_HEADER } from '#tests/config/setup/languages.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import type { SizeCase } from '#tests/types/configurations.ts';

test('Bash function-size counts C-style loops as branches and nesting, not their header assignments', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            level: 'all',
            tables: '[limits.bash]\nmax_function_branches = 3\nmax_block_nesting = 3\nmax_function_assignments = 1\n',
        }),
        'source.sh': COUNTED_LOOPS,
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/function-size');
    expect(findings.map(({ rule, line, message }) => ({ rule, line, message }))).toStrictEqual([
        { rule: 'function-branches', line: 1, message: expect.stringMatching(/\bmain\b.+\b4\b.+\b3\b/u) as string },
        { rule: 'block-nesting', line: 1, message: expect.stringMatching(/\bmain\b.+\b4\b.+\b3\b/u) as string },
        { rule: 'function-assignments', line: 1, message: expect.stringMatching(/\bmain\b.+\b2\b.+\b1\b/u) as string },
    ]);
});

test.each(buildSizeCases())(
    '$rule reports a function over its limit and passes after the fix',
    async ({ source, corrected, rule, line, limit }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['bash'], {
                level: 'all',
                tables: '[limits.bash]\nmax_function_lines = 12\nmax_function_branches = 4\nmax_block_nesting = 2\nmax_function_assignments = 3\n',
            }),
            'script.sh': source,
        });
        const findings = await runSandboxCheck(sandbox.path, 'bash/function-size');
        const counts = new RegExp(String.raw`\bmain\b.+\b${String(limit + 1)}\b.+\b${String(limit)}\b`, 'u');
        expect(
            findings.map((finding) => ({ rule: finding.rule, line: finding.line, message: finding.message })),
        ).toStrictEqual([{ rule, line, message: expect.stringMatching(counts) as string }]);
        await writeFile(join(sandbox.path, 'script.sh'), corrected);
        expect(await runSandboxCheck(sandbox.path, 'bash/function-size')).toStrictEqual([]);
    },
);

function buildNestedConditions(depth: number): string {
    const opening = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (index + 1))}if [[ -n "$1" ]]; then`);
    const closing = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (depth - index))}fi`);
    return [...opening, `${' '.repeat(4 * (depth + 1))}echo "$1"`, ...closing].join('\n');
}

function buildSizeCases(): SizeCase[] {
    return BASH_SIZE_CASES.map(({ rule, line, limit }) => {
        let body: string;
        let correctedBody: string;
        switch (rule) {
            case 'function-lines': {
                correctedBody = Array.from(
                    { length: limit - 2 },
                    (_, index) => `    echo "line ${String(index)}"`,
                ).join('\n');
                body = `${correctedBody}\n    echo "$1"`;
                break;
            }
            case 'function-branches': {
                correctedBody = Array.from(
                    { length: limit },
                    (_, index) => `    if [[ "$1" == "${String(index)}" ]]; then echo "$1"; fi`,
                ).join('\n');
                body = `${correctedBody}\n    if [[ -n "$1" ]]; then echo "$1"; fi`;
                break;
            }
            case 'block-nesting': {
                correctedBody = buildNestedConditions(limit);
                body = buildNestedConditions(limit + 1);
                break;
            }
            case 'function-assignments': {
                const assignments = Array.from(
                    { length: limit },
                    (_, index) => `    total="\${1}${String(index)}"`,
                ).join('\n');
                correctedBody = `${assignments}\n    echo "\${total}"`;
                body = `${assignments}\n    total="$1"\n    echo "\${total}"`;
                break;
            }
        }
        return {
            rule,
            line,
            limit,
            source: `${BASH_HEADER}# main: runs the sample.\nmain() {\n${body}\n}\n\nmain "$@"\n`,
            corrected: `${BASH_HEADER}# main: runs the sample.\nmain() {\n${correctedBody}\n}\n\nmain "$@"\n`,
        };
    });
}
