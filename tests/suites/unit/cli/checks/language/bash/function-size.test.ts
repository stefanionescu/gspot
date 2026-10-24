import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { type SizeCase } from '#tests/types/samples.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { BASH_HEADER } from '#tests/config/checks/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PASSED_BASH_RESULTS } from '#tests/config/checks/language/bash/samples.ts';

import {
    COUNTED_LOOPS,
    BASH_SIZE_CASES,
    CORRECTED_LOOPS,
    NESTED_CONDITION,
} from '#tests/config/checks/language/bash/function-size.ts';

test('Bash function-size counts C-style loops as branches and nesting, not their header assignments, in each scope', async () => {
    const LOOP_COUNTS = [
        { rule: 'function-branches', message: 'main has 4 branches, over the limit of 3.' },
        { rule: 'block-nesting', message: 'main has 4 levels of nesting, over the limit of 3.' },
        { rule: 'function-assignments', message: 'main has 2 assignments, over the limit of 1.' },
    ] as const;

    const options = buildRunOptions({ only: ['bash/function-size'] });
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], {
            level: 'all',
            tables: '[limits.bash]\nfunction_branches = 3\nblock_nesting = 3\nfunction_assignments = 1\n',
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
        expect(check.findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual([...LOOP_COUNTS]);
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
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
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
    const opening = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (index + 1))}${NESTED_CONDITION}`);
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
