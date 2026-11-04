import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { BASH_HEADER } from '#tests/config/setup/languages.ts';
import type { SizeCase } from '#tests/types/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    COUNTED_LOOPS,
    BASH_SIZE_CASES,
    CORRECTED_LOOPS,
    PASSED_BASH_RESULTS,
} from '#tests/config/configurations/bash.ts';

test('Bash function-size counts C-style loops as branches and nesting, not their header assignments, in each scope', async () => {
    const options = buildRunOptions({ only: ['bash/function-size'] });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            level: 'all',
            tables: '[limits.bash]\nmax_function_branches = 3\nmax_block_nesting = 3\nmax_function_assignments = 1\n',
            scopes: [{ path: 'api' }],
        }),
        'source.sh': COUNTED_LOOPS,
        'api/source.sh': COUNTED_LOOPS,
    });

    const broken = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['bash/function-size'] }));

    const checks = broken.report.checks;
    expect(checks.map(({ scope, fileCount }) => ({ scope, fileCount }))).toStrictEqual([
        { scope: '', fileCount: 1 },
        { scope: 'api', fileCount: 1 },
    ]);
    for (const check of checks) {
        expect(check.findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual([
            { rule: 'function-branches', message: expect.stringMatching(/\bmain\b.+\b4\b.+\b3\b/u) as string },
            { rule: 'block-nesting', message: expect.stringMatching(/\bmain\b.+\b4\b.+\b3\b/u) as string },
            { rule: 'function-assignments', message: expect.stringMatching(/\bmain\b.+\b2\b.+\b1\b/u) as string },
        ]);
        expect(check.findings.map(({ file, line }) => ({ file, line }))).toStrictEqual(
            Array.from({ length: 3 }, () => ({
                file: check.scope === '' ? 'source.sh' : 'api/source.sh',
                line: 1,
            })),
        );
    }
    for (const path of ['source.sh', 'api/source.sh']) await writeFile(join(sandbox.path, path), CORRECTED_LOOPS);
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks).toMatchObject([...PASSED_BASH_RESULTS]);
});

test.each(buildSizeCases())(
    '$rule reports $file and passes after the fix',
    async ({ source, corrected: fixedSource, file, rule, line, message }) => {
        const options = buildRunOptions({ only: ['bash/function-size'] });
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['bash'], {
                level: 'all',
                tables: '[limits.bash]\nmax_function_lines = 12\nmax_function_branches = 4\nmax_block_nesting = 2\nmax_function_assignments = 3\n',
            }),
            [file]: source,
        });

        const failed = await runChecks(await openSession(sandbox.path), options);

        expect(
            failed.report.checks.flatMap(({ findings }) =>
                findings.map((finding) => ({
                    file: finding.file,
                    rule: finding.rule,
                    line: finding.line,
                    message: finding.message,
                })),
            ),
        ).toStrictEqual([{ file, rule, line, message }]);
        await writeFile(join(sandbox.path, file), fixedSource);
        const corrected = await runChecks(await openSession(sandbox.path), options);

        expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    },
);

function buildNestedConditions(depth: number): string {
    const opening = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (index + 1))}if [[ -n "$1" ]]; then`);
    const closing = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (depth - index))}fi`);
    return [...opening, `${' '.repeat(4 * (depth + 1))}echo "$1"`, ...closing].join('\n');
}

function buildSizeCases(): SizeCase[] {
    return BASH_SIZE_CASES.map(({ file, rule, line, limit, message }) => {
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
            file,
            rule,
            line,
            source: `${BASH_HEADER}# main: runs the sample.\nmain() {\n${body}\n}\n\nmain "$@"\n`,
            corrected: `${BASH_HEADER}# main: runs the sample.\nmain() {\n${correctedBody}\n}\n\nmain "$@"\n`,
            message,
        };
    });
}
