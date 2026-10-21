import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { listSettings } from '#cli/settings/known.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { SizeCase } from '#tests/types/samples.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { commitAll, markExecutable } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { NESTED_CONDITION } from '#tests/data/checks/bash/tool-checks.ts';
import { BASH_TRIVIAL_FUNCTION_CASES } from '#tests/data/checks/structure/trivial-functions.ts';
import { BASH_HEADER, BASH_SANDBOX, CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

import {
    runCheckSample,
    expectedSummary,
    buildSampleSummary,
    registerBashSandbox,
} from '#tests/setup/sample-checks.ts';
import {
    FIXED_LOOPS,
    LOOP_COUNTS,
    COUNTED_LOOPS,
    BASH_SIZE_CASES,
    DOC_COMMENT_CASES,
    TRAP_FUNCTION_SOURCE,
    UNREAD_ARGUMENT_CASES,
    UNUSED_FUNCTION_CASES,
} from '#tests/data/checks/bash/function-checks.ts';
import {
    SAFETY_SOURCES,
    BASH_SAFETY_CASES,
    SCOPE_READER_FILES,
    PASSED_BASH_RESULTS,
    INLINE_SCRIPT_CASES,
    SCRIPT_LAYOUT_CASES,
    RIGHT_CLEANUP_SOURCE,
    WRONG_CLEANUP_SOURCE,
    SCOPE_READER_SETTINGS,
} from '#tests/data/checks/bash/script-checks.ts';

/**
 * Read the shipped default of a Bash size limit.
 *
 * @param name the Bash size setting.
 * @returns its declared numeric default.
 */
function getDefaultLimit(name: string): number {
    const setting = listSettings('structure').find(({ name: key }) => key === `limits.${name}`)!;
    return Number(setting.language_defaults?.['bash'] ?? setting.default);
}
/**
 * Produce exactly this many nested Bash blocks.
 *
 * @param depth the count of nested conditions.
 * @returns the function body.
 */
function buildNestedConditions(depth: number): string {
    const opening = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (index + 1))}${NESTED_CONDITION}`);
    const closing = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (depth - index))}fi`);
    return [...opening, `${' '.repeat(4 * (depth + 1))}echo "$1"`, ...closing].join('\n');
}

/** Build each function-size sample together with its location, fix, and diagnostic. */
function buildSizeCases(): SizeCase[] {
    return BASH_SIZE_CASES.map(({ file, rule, line }) => {
        const limit = getDefaultLimit(rule.replaceAll('-', '_'));
        let body: string;
        let correctedBody: string;
        let measure: string;
        switch (rule) {
            case 'function-lines': {
                correctedBody = Array.from(
                    { length: limit - 2 },
                    (_, index) => `    echo "line ${String(index)}"`,
                ).join('\n');
                body = `${correctedBody}\n    echo "$1"`;
                measure = 'code lines';
                break;
            }
            case 'function-branches': {
                correctedBody = Array.from(
                    { length: limit },
                    (_, index) => `    if [[ "$1" == "${String(index)}" ]]; then echo "$1"; fi`,
                ).join('\n');
                body = `${correctedBody}\n    if [[ -n "$1" ]]; then echo "$1"; fi`;
                measure = 'branches';
                break;
            }
            case 'block-nesting': {
                correctedBody = buildNestedConditions(limit);
                body = buildNestedConditions(limit + 1);
                measure = 'levels of nesting';
                break;
            }
            case 'function-assignments': {
                const assignments = Array.from(
                    { length: limit },
                    (_, index) => `    total="\${1}${String(index)}"`,
                ).join('\n');
                correctedBody = `${assignments}\n    echo "\${total}"`;
                body = `${assignments}\n    total="$1"\n    echo "\${total}"`;
                measure = 'assignments';
                break;
            }
        }
        return {
            file,
            rule,
            line,
            source: `${BASH_HEADER}# main: runs the sample.\nmain() {\n${body}\n}\n\nmain "$@"\n`,
            corrected: `${BASH_HEADER}# main: runs the sample.\nmain() {\n${correctedBody}\n}\n\nmain "$@"\n`,
            message: `main has ${String(limit + 1)} ${measure}, over the limit of ${String(limit)}.`,
        };
    });
}

test.each([...SAFETY_SOURCES])(
    'safety: a trap that removes its own temporary file is allowed and other recursive removals are reported: $source',
    async ({ source, unsafeLines }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash']),
            'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\n' + source,
        });
        const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['bash/safety'] }));

        expect(result.report.checks[0]?.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            unsafeLines.map((line) => ({ file: 'source.sh', line, rule: 'recursive-remove' })),
        );
    },
);

test('safety: the Bash contract and safety agree on the specific temporary path that a trap removes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': WRONG_CLEANUP_SOURCE,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');

    const wrong = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['bash/script-layout', 'bash/safety'] }),
    );

    expect(
        wrong.report.checks.flatMap(({ findings }) => findings.map(({ rule, line }) => ({ rule, line }))),
    ).toStrictEqual([
        { rule: 'mktemp-trap', line: 3 },
        { rule: 'recursive-remove', line: 4 },
    ]);
    await writeFile(join(sandbox.path, 'source.sh'), RIGHT_CLEANUP_SOURCE);
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['bash/script-layout', 'bash/safety'] }),
    );

    expect(corrected.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual(
        PASSED_BASH_RESULTS,
    );
});
test('script-layout: script-layout permits top-level commands in an environment reader declared only by its scope', async () => {
    await using sandbox = await testdir({
        ...SCOPE_READER_FILES,
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', tables: SCOPE_READER_SETTINGS }),
    });
    expect(await checkFindings(sandbox.path, 'bash/script-layout', { scope: 'tools' })).toStrictEqual([]);
});

const bashSandbox = registerBashSandbox();
test.each([
    ...DOC_COMMENT_CASES,
    ...INLINE_SCRIPT_CASES,
    ...BASH_SAFETY_CASES,
    ...SCRIPT_LAYOUT_CASES,
    ...UNREAD_ARGUMENT_CASES,
    ...UNUSED_FUNCTION_CASES,
    ...BASH_TRIVIAL_FUNCTION_CASES,
])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(bashSandbox(), entry, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
test.each(buildSizeCases())(
    '$rule reports $file and passes after the fix',
    async ({ source, corrected: fixedSource, file, rule, line, message }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
            [file]: source,
        });

        const failed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['bash/function-size'] }),
        );

        expect(failed.report.checks.flatMap(({ findings }) => findings)).toContainEqual(
            matchFields({ file, rule, line, message }),
        );
        await writeFile(join(sandbox.path, file), fixedSource);
        const corrected = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['bash/function-size'] }),
        );

        expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    },
);
test('Bash function-size counts C-style loops as branches and nesting, not their header assignments, in each scope', async () => {
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
    for (const path of ['source.sh', 'api/source.sh']) await writeFile(join(sandbox.path, path), FIXED_LOOPS);
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['bash/function-size'] }),
    );

    expect(corrected.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual(
        PASSED_BASH_RESULTS,
    );
});

test('inline-scripts: a heredoc that writes a data file is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': '#!/usr/bin/env bash\ncat > settings.json <<EOF\n{ "name": "example" }\nEOF\n',
    });
    expect(await checkFindings(sandbox.path, 'bash/inline-scripts')).toStrictEqual([]);
});

test('a function that only a trap runs is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': TRAP_FUNCTION_SOURCE,
    });
    expect(await checkFindings(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test('main "$@" with a main that reads no argument is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');
    expect(await checkFindings(sandbox.path, 'bash/script-layout')).toStrictEqual([]);
    expect(await checkFindings(sandbox.path, 'bash/unread-arguments')).toStrictEqual([]);
});
