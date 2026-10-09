import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { commitAll } from '#tests/harness/git.ts';
import { HEAD } from '#tests/config/samples/bash.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { chmod, appendFile } from 'node:fs/promises';
import { GUIDE } from '#tests/config/samples/docs.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { installToolProjects } from '#tests/harness/install.ts';
import { installedModules } from '#tests/harness/environment.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import * as postgres from '#tests/config/tools/configurations/database.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import * as toolPytest from '#tests/config/tools/configurations/tool/pytest.ts';
import * as toolVitest from '#tests/config/tools/configurations/tool/vitest.ts';
import * as languageSql from '#tests/config/tools/configurations/language/sql.ts';
import * as toolAnsible from '#tests/config/tools/configurations/tool/ansible.ts';
import * as toolOpenapi from '#tests/config/tools/configurations/tool/openapi.ts';
import type { BashBoundary, ConfigurationCallbacks } from '#tests/types/tools/cases.ts';
import * as frameworkNestjs from '#tests/config/tools/configurations/framework/nestjs.ts';
import * as frameworkNextjs from '#tests/config/tools/configurations/framework/nextjs.ts';
import { createTestRepository, prepareTestRepository } from '#tests/harness/repository.ts';
import { MODULE_PATH, CLEAN_MODULE, ARITHMETIC_TESTS } from '#tests/config/samples/python.ts';
import * as languagePython from '#tests/config/tools/configurations/language/python/checks.ts';
import * as languageBashChecks from '#tests/config/tools/configurations/language/bash/checks.ts';
import type { InstalledScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import * as languageSwiftChecks from '#tests/config/tools/configurations/language/swift/checks.ts';
import { SCENARIOS, SQL_EXCLUSION, BASH_LOCATIONS } from '#tests/config/tools/configurations/cases.ts';
import * as markdownDocsProse from '#tests/config/tools/configurations/general/markdown-docs-prose.ts';
import { DOUBLE_JS, ARCHITECTURE } from '#tests/config/tools/configurations/language/typescript/source.ts';
import * as languageTypescriptChecks from '#tests/config/tools/configurations/language/typescript/checks.ts';

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
const BOUNDARIES: BashBoundary[] = [
    {
        source: `${HEAD}${filesAtLimit}\nreadonly EXTRA=1\n`,
        corrected: `${HEAD}${filesAtLimit}\n`,
        expected: {
            ...BASH_LOCATIONS[0],
            message: `This file has ${String(fileLines + 1)} code lines, over the ceiling of ${String(fileLines)}.`,
        },
    },
    {
        source: `${HEAD}# main: prints each line.\nmain() {\n${bodyAtLimit}\n    echo "$1"\n}\n\nmain "$@"\n`,
        corrected: `${HEAD}# main: prints each line.\nmain() {\n${bodyAtLimit}\n}\n\nmain "$@"\n`,
        expected: {
            ...BASH_LOCATIONS[1],
            message: `main has ${String(functionLines + 1)} code lines, over the ceiling of ${String(functionLines)}.`,
        },
    },
    {
        source: `${HEAD}# main: selects a branch.\nmain() {\n${branchesAtLimit}\n    if [[ -n "$1" ]]; then echo "$1"; fi\n}\n\nmain "$@"\n`,
        corrected: `${HEAD}# main: selects a branch.\nmain() {\n${branchesAtLimit}\n}\n\nmain "$@"\n`,
        expected: {
            ...BASH_LOCATIONS[2],
            message: `main has ${String(branches + 1)} branches, over the ceiling of ${String(branches)}.`,
        },
    },
    {
        source: `${HEAD}# main: selects nested conditions.\nmain() {\n${nestedConditions(nesting + 1)}\n}\n\nmain "$@"\n`,
        corrected: `${HEAD}# main: selects nested conditions.\nmain() {\n${nestedConditions(nesting)}\n}\n\nmain "$@"\n`,
        expected: {
            ...BASH_LOCATIONS[3],
            message: `main has ${String(nesting + 1)} levels of nesting, over the ceiling of ${String(nesting)}.`,
        },
    },
    {
        source: `${HEAD}# main: updates its value.\nmain() {\n${assignmentsAtLimit}\n    total="$1"\n    echo "\${total}"\n}\n\nmain "$@"\n`,
        corrected: `${HEAD}# main: updates its value.\nmain() {\n${assignmentsAtLimit}\n    echo "\${total}"\n}\n\nmain "$@"\n`,
        expected: {
            ...BASH_LOCATIONS[4],
            message: `main has ${String(assignments + 1)} assignments, over the ceiling of ${String(assignments)}.`,
        },
    },
];
const CALLBACKS = new Map<InstalledScenario, ConfigurationCallbacks>([
    [
        toolPytest.REPOSITORY,
        {
            before: async (root) => {
                expect(await runTestCommand(['uv', 'sync'], { cwd: root })).toMatchObject({ code: 0 });
            },
        },
    ],
    [postgres.REPOSITORY, { prepare: commitAll }],
    [
        toolOpenapi.REPOSITORY,
        {
            files: {
                ...toolOpenapi.REPOSITORY.files,
                'write-document.js': `await Bun.write('openapi.yaml', ${JSON.stringify(toolOpenapi.DOCUMENT)});\n`,
            },
        },
    ],
    [
        languagePython.REPOSITORY,
        {
            corrected: () => ({
                files: { [MODULE_PATH]: CLEAN_MODULE },
            }),
        },
    ],
    [
        languageSql.REPOSITORY,
        {
            prepare: async (root, environment) => {
                const excluded = await spawnGspot(
                    root,
                    ['ignore', 'sql/sqlfluff', '--paths', ...SQL_EXCLUSION.paths, '--reason', SQL_EXCLUSION.reason],
                    environment,
                );
                if (excluded.code !== 0)
                    throw new Error(`The exclusion was not set: ${excluded.stdout}${excluded.stderr}`);
            },
            corrected: (entry) => ({
                files: Object.fromEntries(Object.keys(entry.files).map((file) => [file, languageSql.SQL_CLEAN])),
            }),
        },
    ],
    [
        languageTypescriptChecks.REPOSITORY,
        {
            prepare: async (root, environment) => {
                await appendFile(join(root, 'gspot.toml'), `\n${ARCHITECTURE}`);
                const applied = await spawnGspot(root, ['apply'], environment);
                if (applied.code !== 0) throw new Error(applied.stdout + applied.stderr);
                await installToolProjects(root);
                const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--fix'], environment);
                if (formatted.code !== 0) throw new Error(formatted.stdout + formatted.stderr);
            },
        },
    ],
    [
        languageSwiftChecks.REPOSITORY,
        {
            corrected: (entry) => ({
                files: Object.fromEntries(
                    Object.keys(entry.files).map((path, index) => [
                        path,
                        CLEAN_SWIFT.replaceAll('greeting', index === 0 ? 'greetPerson' : 'greetVisitor').replaceAll(
                            'hello',
                            `welcome ${String(index)}`,
                        ),
                    ]),
                ),
            }),
        },
    ],
    [
        languageBashChecks.REPOSITORY,
        {
            before: async (root) => {
                await chmod(join(root, 'scripts/build.sh'), 0o755);
            },
            corrected: (entry) => ({
                files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, languageBashChecks.CLEAN])),
            }),
            cases: [
                ...languageBashChecks.CASES,
                ...BOUNDARIES.map((entry) => ({
                    check: entry.expected.rule === 'file-lines' ? 'structure/file-lines' : 'bash/function-size',
                    files: { [entry.expected.file]: entry.source },
                    expected: entry.expected,
                    corrected: { files: { [entry.expected.file]: entry.corrected } },
                })),
            ],
        },
    ],
    [
        markdownDocsProse.REPOSITORY,
        {
            corrected: (entry) => ({
                files: Object.fromEntries(
                    Object.keys(entry.files).map((path) => [path, markdownDocsProse.CORRECTIONS[entry.check] ?? GUIDE]),
                ),
            }),
        },
    ],
    [
        frameworkNextjs.REPOSITORY,
        {
            dirname: join(installedModules, '../..', `gspot-test-${randomUUID()}`),
        },
    ],
]);

for (const declared of SCENARIOS) {
    const callbacks = CALLBACKS.get(declared.repository);
    let scenario = declared;
    if (callbacks !== undefined) {
        const { cases = declared.cases, ...configuration } = callbacks;
        scenario = { ...declared, cases, repository: { ...declared.repository, ...configuration } };
    }
    const cases = structuredClone(scenario.cases);
    for (const entry of cases) {
        if (declared.repository === toolPytest.REPOSITORY)
            entry.files['tests/test_math.py'] = ARITHMETIC_TESTS.replace('    assert triple(2) == 6\n', '').replace(
                ', triple',
                '',
            );
        if (declared.repository === frameworkNestjs.REPOSITORY)
            entry.files['src/greeting.controller.ts'] = frameworkNestjs.CONTROLLER.replace(
                "@Get(':name')",
                "@Get(':id')",
            );
        if (declared.repository === languageSwiftChecks.REPOSITORY && entry.check === 'swift/swiftformat')
            entry.files['Sources/App/Greeting.swift'] = CLEAN_SWIFT.replace('func greeting', 'func   greeting');
        if (declared.repository === languageTypescriptChecks.REPOSITORY && entry.check === 'javascript/tsc')
            entry.files['src/orders/double.js'] = DOUBLE_JS.replace('twice(3)', 'twice("x")');
        if (declared.repository === toolVitest.REPOSITORY)
            entry.corrected!.files['src/math.test.ts'] =
                toolVitest.TEST.replace('positiveTotal }', 'positiveTotal, triple }') + toolVitest.TRIPLE_TEST;
    }
    describe.skipIf(
        (declared.repository === toolAnsible.REPOSITORY && !hasToolBuild('ansible-lint')) ||
            (declared.platforms !== undefined && !declared.platforms.includes(process.platform)),
    )(declared.name, () => {
        const resources = new AsyncDisposableStack();
        let repository: OwnedTestRepository;
        beforeAll(async () => {
            repository = resources.use(
                await createTestRepository(scenario.repository, spawnGspot, prepareTestRepository),
            );
        });
        afterAll(() => resources.disposeAsync());
        for (const entry of cases) {
            const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
            const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
            test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
                `${entry.check} reports ${where} and passes after the fix`,
                async () => {
                    const { failed, passed } = await runFindingCase(repository, entry, scenario.repository);
                    const { message, ...position } = entry.expected;
                    expect(failed.code, `${entry.check}: ${failed.stdout}${failed.stderr}`).toBe(1);
                    expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                    expect(failed.report.checks[0]?.findings).toContainEqual(
                        containing({
                            check: entry.check,
                            ...position,
                            ...(message === undefined ? {} : { message: textContaining(message) }),
                        }),
                    );
                    expect(passed.code, `${entry.check} corrected: ${passed.stdout}${passed.stderr}`).toBe(0);
                    expect(passed.report.checks).toMatchObject([
                        { check: entry.check, status: 'passed', findings: [] },
                    ]);
                },
            );
        }
    });
}
