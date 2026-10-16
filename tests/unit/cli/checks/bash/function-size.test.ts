import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { BASH_HEADER } from '#tests/data/checks/bash/samples.ts';
import { listConfigurationSettings } from '#cli/settings/known.ts';
import { NESTED_CONDITION } from '#tests/data/checks/bash/tool-checks.ts';

import {
    FIXED_LOOPS,
    LOOP_COUNTS,
    COUNTED_LOOPS,
    BASH_SIZE_LOCATIONS,
} from '#tests/data/checks/bash/function-checks.ts';

/**
 * Read the declared boundary used by the installed configuration.
 * @param name the Bash size setting.
 * @returns its declared numeric default.
 */
function getDefaultLimit(name: string): number {
    const setting = listConfigurationSettings('structure').find(
        ({ name: key }) => key === name.replace('limits.bash.', 'limits.'),
    )!;
    return Number(setting.language_defaults?.['bash'] ?? setting.default);
}
/**
 * Produce exactly this many nested Bash blocks.
 * @param depth the count of nested conditions.
 * @returns the function body.
 */
function buildNestedConditions(depth: number): string {
    const opening = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (index + 1))}${NESTED_CONDITION}`);
    const closing = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (depth - index))}fi`);
    return [...opening, `${' '.repeat(4 * (depth + 1))}echo "$1"`, ...closing].join('\n');
}
function buildFileSizeCase() {
    const fileLines = getDefaultLimit('limits.bash.file_lines');
    // The header contributes the set and shopt commands; each declaration adds one code line.
    const filesAtLimit = Array.from(
        { length: fileLines - 2 },
        (_, index) => `readonly VALUE_${String(index)}=${String(index)}`,
    ).join('\n');
    return {
        source: `${BASH_HEADER}${filesAtLimit}\nreadonly EXTRA=1\n`,
        corrected: `${BASH_HEADER}${filesAtLimit}\n`,
        expected: {
            ...BASH_SIZE_LOCATIONS[0],
            message: `This file has ${String(fileLines + 1)} code lines, over the limit of ${String(fileLines)}.`,
        },
    };
}
function buildSizeCases() {
    const functionLines = getDefaultLimit('limits.bash.function_lines');
    const branches = getDefaultLimit('limits.bash.function_branches');
    const nesting = getDefaultLimit('limits.bash.block_nesting');
    const assignments = getDefaultLimit('limits.bash.function_assignments');
    const bodyAtLimit = Array.from({ length: functionLines }, (_, index) => `    echo "line ${String(index)}"`).join(
        '\n',
    );
    const branchesAtLimit = Array.from(
        { length: branches },
        (_, index) => `    if [[ "$1" == "${String(index)}" ]]; then echo "$1"; fi`,
    ).join('\n');
    const assignmentsAtLimit = Array.from(
        { length: assignments },
        (_, index) => `    total="\${1}${String(index)}"`,
    ).join('\n');
    return [
        buildFileSizeCase(),
        {
            source: `${BASH_HEADER}# main: prints each line.\nmain() {\n${bodyAtLimit}\n    echo "$1"\n}\n\nmain "$@"\n`,
            corrected: `${BASH_HEADER}# main: prints each line.\nmain() {\n${bodyAtLimit}\n}\n\nmain "$@"\n`,
            expected: {
                ...BASH_SIZE_LOCATIONS[1],
                message: `main has ${String(functionLines + 1)} code lines, over the limit of ${String(functionLines)}.`,
            },
        },
        {
            source: `${BASH_HEADER}# main: selects a branch.\nmain() {\n${branchesAtLimit}\n    if [[ -n "$1" ]]; then echo "$1"; fi\n}\n\nmain "$@"\n`,
            corrected: `${BASH_HEADER}# main: selects a branch.\nmain() {\n${branchesAtLimit}\n}\n\nmain "$@"\n`,
            expected: {
                ...BASH_SIZE_LOCATIONS[2],
                message: `main has ${String(branches + 1)} branches, over the limit of ${String(branches)}.`,
            },
        },
        {
            source: `${BASH_HEADER}# main: selects nested conditions.\nmain() {\n${buildNestedConditions(nesting + 1)}\n}\n\nmain "$@"\n`,
            corrected: `${BASH_HEADER}# main: selects nested conditions.\nmain() {\n${buildNestedConditions(nesting)}\n}\n\nmain "$@"\n`,
            expected: {
                ...BASH_SIZE_LOCATIONS[3],
                message: `main has ${String(nesting + 1)} levels of nesting, over the limit of ${String(nesting)}.`,
            },
        },
        {
            source: `${BASH_HEADER}# main: updates its value.\nmain() {\n${assignmentsAtLimit}\n    total="$1"\n    echo "\${total}"\n}\n\nmain "$@"\n`,
            corrected: `${BASH_HEADER}# main: updates its value.\nmain() {\n${assignmentsAtLimit}\n    echo "\${total}"\n}\n\nmain "$@"\n`,
            expected: {
                ...BASH_SIZE_LOCATIONS[4],
                message: `main has ${String(assignments + 1)} assignments, over the limit of ${String(assignments)}.`,
            },
        },
    ];
}
test.each(BASH_SIZE_LOCATIONS.map((expected, index) => ({ expected, index })))(
    '$expected.rule reports $expected.file and passes after the fix',
    async ({ index }) => {
        const entry = buildSizeCases()[index]!;
        const check = entry.expected.rule === 'file-lines' ? 'structure/long-files' : 'bash/function-size';
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['bash'], { level: 'all' }),
            [entry.expected.file]: entry.source,
        });
        const command = ['check', '--only', check, '--json'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toContainEqual(
            matchFields(entry.expected),
        );
        await Bun.write(join(sandbox.path, entry.expected.file), entry.corrected);
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual(
            [],
        );
    },
);
test('Bash function-size counts C-style loops as branches and nesting, not their header assignments, in each scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['bash'], {
            level: 'all',
            tables: '[limits.bash]\nfunction_branches = 3\nblock_nesting = 3\nfunction_assignments = 1\n[[scope]]\npath = "api"\n\n',
        }),
        'source.sh': COUNTED_LOOPS,
        'api/source.sh': COUNTED_LOOPS,
    });
    const environment = {};
    const command = ['check', '--only', 'bash/function-size', '--json'];
    const broken = await runGspot(sandbox.path, command, environment);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const checks = (JSON.parse(broken.stdout) as RunReport).checks;
    expect(checks.map(({ scope, fileCount }) => ({ scope, fileCount }))).toStrictEqual([
        { scope: '', fileCount: 1 },
        { scope: 'api', fileCount: 1 },
    ]);
    for (const check of checks) {
        expect(check.findings.map(({ rule, message }) => ({ rule, message: message }))).toStrictEqual([...LOOP_COUNTS]);
        expect(check.findings.map(({ file, line }) => ({ file, line }))).toStrictEqual(
            Array.from({ length: 3 }, () => ({
                file: check.scope === '' ? 'source.sh' : 'api/source.sh',
                line: 1,
            })),
        );
    }
    for (const path of ['source.sh', 'api/source.sh']) await Bun.write(join(sandbox.path, path), FIXED_LOOPS);
    const corrected = await runGspot(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        (JSON.parse(corrected.stdout) as RunReport).checks.map(({ status, findings }) => ({ status, findings })),
    ).toStrictEqual([
        { status: 'passed', findings: [] },
        { status: 'passed', findings: [] },
    ]);
});
