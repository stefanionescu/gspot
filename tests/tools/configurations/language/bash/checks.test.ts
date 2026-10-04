// The Bash checks that run a tool, on an installed repository: each fires on its defect and accepts the correction.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { test, afterAll, describe, beforeAll } from 'bun:test';
import { expectCheckCase } from '#tests/harness/expectations.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { HEAD, BASH_CASES, TOOL_CHECKS } from '#tests/config/samples/bash.ts';
import { CLEAN, REPOSITORY } from '#tests/config/tools/configurations/language/bash/checks.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

/**
 * Read the declared boundary used by the installed configuration.
 * @param name the Bash size setting
 * @returns its declared numeric default
 */
function defaultLimit(name: string): number {
    const value = configurationManifests()
        .get('structure')!
        .settings.find((setting) => setting.name === name)!.default;
    if (typeof value !== 'number') throw new TypeError(`The declared ${name} default must be numeric.`);
    return value;
}

/**
 * Produce exactly this many nested Bash blocks.
 * @param depth the count of nested conditions
 * @returns the function body
 */
function nestedConditions(depth: number): string {
    const opening = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (index + 1))}if [[ -n "$1" ]]; then`);
    const closing = Array.from({ length: depth }, (_, index) => `${' '.repeat(4 * (depth - index))}fi`);
    return [...opening, `${' '.repeat(4 * (depth + 1))}echo "$1"`, ...closing].join('\n');
}

const fileLines = defaultLimit('limits.bash.file_lines');
const functionLines = defaultLimit('limits.bash.function_lines');
const branches = defaultLimit('limits.bash.branches');
const nesting = defaultLimit('limits.bash.nesting');
const assignments = defaultLimit('limits.bash.assignments');
// HEAD contributes the set and shopt commands; every readonly statement adds one code line.
const filesAtLimit = Array.from(
    { length: fileLines - 2 },
    (_, index) => `readonly VALUE_${String(index)}=${String(index)}`,
).join('\n');
const bodyAtLimit = Array.from({ length: functionLines }, (_, index) => `    echo "line ${String(index)}"`).join('\n');
const branchesAtLimit = Array.from(
    { length: branches },
    (_, index) => `    if [[ "$1" == "${String(index)}" ]]; then echo "$1"; fi`,
).join('\n');
const assignmentsAtLimit = Array.from({ length: assignments }, (_, index) => `    total="\${1}${String(index)}"`).join(
    '\n',
);
const boundaries: FindingCase[] = [
    {
        check: 'bash/limits',
        files: { 'scripts/long.sh': `${HEAD}${filesAtLimit}\nreadonly EXTRA=1\n` },
        expected: {
            file: 'scripts/long.sh',
            rule: 'file-lines',
            line: 1,
            message: `This file has ${String(fileLines + 1)} code lines, over the ceiling of ${String(fileLines)}.`,
        },
        corrected: { files: { 'scripts/long.sh': `${HEAD}${filesAtLimit}\n` } },
    },
    {
        check: 'bash/limits',
        files: {
            'scripts/tall.sh': `${HEAD}# main: prints each line.\nmain() {\n${bodyAtLimit}\n    echo "$1"\n}\n\nmain "$@"\n`,
        },
        expected: {
            file: 'scripts/tall.sh',
            rule: 'function-lines',
            line: 9,
            message: `main has ${String(functionLines + 1)} code lines, over the ceiling of ${String(functionLines)}.`,
        },
        corrected: {
            files: {
                'scripts/tall.sh': `${HEAD}# main: prints each line.\nmain() {\n${bodyAtLimit}\n}\n\nmain "$@"\n`,
            },
        },
    },
    {
        check: 'bash/limits',
        files: {
            'scripts/branchy.sh': `${HEAD}# main: selects a branch.\nmain() {\n${branchesAtLimit}\n    if [[ -n "$1" ]]; then echo "$1"; fi\n}\n\nmain "$@"\n`,
        },
        expected: {
            file: 'scripts/branchy.sh',
            rule: 'branches',
            line: 9,
            message: `main has ${String(branches + 1)} branches, over the ceiling of ${String(branches)}.`,
        },
        corrected: {
            files: {
                'scripts/branchy.sh': `${HEAD}# main: selects a branch.\nmain() {\n${branchesAtLimit}\n}\n\nmain "$@"\n`,
            },
        },
    },
    {
        check: 'bash/limits',
        files: {
            'scripts/deep.sh': `${HEAD}# main: selects nested conditions.\nmain() {\n${nestedConditions(nesting + 1)}\n}\n\nmain "$@"\n`,
        },
        expected: {
            file: 'scripts/deep.sh',
            rule: 'nesting',
            line: 9,
            message: `main has ${String(nesting + 1)} levels of nesting, over the ceiling of ${String(nesting)}.`,
        },
        corrected: {
            files: {
                'scripts/deep.sh': `${HEAD}# main: selects nested conditions.\nmain() {\n${nestedConditions(nesting)}\n}\n\nmain "$@"\n`,
            },
        },
    },
    {
        check: 'bash/limits',
        files: {
            'scripts/mutable.sh': `${HEAD}# main: updates its value.\nmain() {\n${assignmentsAtLimit}\n    total="$1"\n    echo "\${total}"\n}\n\nmain "$@"\n`,
        },
        expected: {
            file: 'scripts/mutable.sh',
            rule: 'assignments',
            line: 9,
            message: `main has ${String(assignments + 1)} assignments, over the ceiling of ${String(assignments)}.`,
        },
        corrected: {
            files: {
                'scripts/mutable.sh': `${HEAD}# main: updates its value.\nmain() {\n${assignmentsAtLimit}\n    echo "\${total}"\n}\n\nmain "$@"\n`,
            },
        },
    },
];

describe('the bash configuration', () => {
    const repository: RepositoryScenario = {
        ...REPOSITORY,
        before: (root) => {
            chmodSync(join(root, 'scripts/build.sh'), 0o755);
        },
        corrected: (entry) => ({
            files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, CLEAN])),
        }),
    };
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(repository, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of [...BASH_CASES.filter((entry) => TOOL_CHECKS.includes(entry.check)), ...boundaries]) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                await expectCheckCase(testRepository, entry, repository);
            },
            suiteTimeout(),
        );
    }
});
