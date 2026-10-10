import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { chmod, appendFile } from 'node:fs/promises';
import { GUIDE } from '#tests/config/samples/docs.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { testModules } from '#tests/harness/environment.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { shareRepository } from '#tests/harness/repository.ts';
import { installedPackage } from '#cli/repository/contracts.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import rxjsManifest from 'rxjs/package.json' with { type: 'json' };
import { CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import svelteManifest from 'svelte/package.json' with { type: 'json' };
import vitestManifest from 'vitest/package.json' with { type: 'json' };
import { HEAD, CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import coreManifest from '@nestjs/core/package.json' with { type: 'json' };
import { containing, textContaining } from '#tests/harness/expectations.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';
import commonManifest from '@nestjs/common/package.json' with { type: 'json' };
import * as toolPytest from '#tests/config/tools/configurations/tool/pytest.ts';
import * as toolVitest from '#tests/config/tools/configurations/tool/vitest.ts';
import * as languageSql from '#tests/config/tools/configurations/language/sql.ts';
import * as toolAnsible from '#tests/config/tools/configurations/tool/ansible.ts';
import * as toolOpenapi from '#tests/config/tools/configurations/tool/openapi.ts';
import * as frameworkVue from '#tests/config/tools/configurations/framework/vue.ts';
import type { BashBoundary, ConfigurationCallbacks } from '#tests/types/tools/cases.ts';
import * as frameworkNestjs from '#tests/config/tools/configurations/framework/nestjs.ts';
import * as frameworkSvelte from '#tests/config/tools/configurations/framework/svelte.ts';
import { MODULE_PATH, CLEAN_MODULE, ARITHMETIC_TESTS } from '#tests/config/samples/python.ts';
import * as languagePython from '#tests/config/tools/configurations/language/python/checks.ts';
import * as languageBashChecks from '#tests/config/tools/configurations/language/bash/checks.ts';
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
const vitestPackage =
    JSON.stringify({ ...toolVitest.VITEST_PACKAGE, devDependencies: { vitest: vitestManifest.version } }, null, 4) +
    '\n';
const nestDependencies = Object.fromEntries(
    [
        commonManifest,
        coreManifest,
        installedPackage(undefined, testModules, join(testModules, 'reflect-metadata/package.json'))!,
        rxjsManifest,
    ].map(({ name, version }) => [name!, version!]),
);
const CALLBACKS = new Map<InstalledScenario, ConfigurationCallbacks>([
    [toolVitest.REPOSITORY, { files: { ...toolVitest.REPOSITORY.files, 'package.json': vitestPackage } }],
    [frameworkVue.REPOSITORY, { dependencies: { vue: vueManifest.version } }],
    [frameworkSvelte.REPOSITORY, { dependencies: { svelte: svelteManifest.version } }],
    [frameworkNestjs.REPOSITORY, { dependencies: nestDependencies }],
    [
        toolPytest.REPOSITORY,
        {
            before: async (root) => {
                expect(await runTestCommand(['uv', 'sync'], { cwd: root })).toMatchObject({ code: 0 });
            },
        },
    ],
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
            files: {
                ...languageTypescriptChecks.REPOSITORY.files,
                'jsconfig.json': JSON.stringify(languageTypescriptChecks.JAVASCRIPT_CONFIG, null, 4) + '\n',
            },
            prepare: async (root, environment) => {
                await appendFile(join(root, 'gspot.toml'), ARCHITECTURE);
                const applied = await spawnGspot(root, ['apply'], environment);
                if (applied.code !== 0) throw new Error(applied.stdout + applied.stderr);
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
                files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, CLEAN_BASH_SCRIPT])),
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
]);

for (const declared of SCENARIOS) {
    const callbacks = CALLBACKS.get(declared.repository);
    let scenario = declared;
    if (callbacks !== undefined) {
        const { cases = declared.cases, ...configuration } = callbacks;
        scenario = { ...declared, cases, repository: { ...declared.repository, ...configuration } };
    }
    const entries = structuredClone(scenario.cases);
    for (const entry of entries) {
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
        const repository = shareRepository(() => scenario.repository);

        for (const entry of entries) {
            const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
            const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
            test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
                `${entry.check} reports ${where} and passes after the fix`,
                async () => {
                    const { failed, passed } = await runFindingCase(repository(), entry, scenario.repository);
                    const { message, ...position } = entry.expected;
                    expect(failed.code, `${entry.check}: ${failed.stdout}${failed.stderr}`).toBe(1);
                    expect(failed.report.checks.filter(({ status }) => status !== 'passed')).toMatchObject([
                        { check: entry.check, status: 'failed' },
                    ]);
                    expect(failed.report.checks.flatMap(({ findings }) => findings)).toContainEqual(
                        containing({
                            check: entry.check,
                            ...position,
                            ...(message === undefined ? {} : { message: textContaining(message) }),
                        }),
                    );
                    expect(passed.code, `${entry.check} corrected: ${passed.stdout}${passed.stderr}`).toBe(0);
                    expect(passed.report.checks).toMatchObject(
                        failed.report.checks.map(({ check, scope }) => ({
                            check,
                            scope,
                            status: 'passed',
                            findings: [],
                        })),
                    );
                },
            );
        }
    });
}
