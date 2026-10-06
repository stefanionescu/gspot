import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { toolPin } from '#cli/tools/pins.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { installedModules } from '#tests/harness/environment.ts';
import { cpSync, mkdirSync, symlinkSync, readFileSync } from 'node:fs';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { suppressionComments } from '#cli/checks/general/structure/suppressions.ts';

import {
    COMPILER_REASON,
    COMPILER_SOURCE,
    COMPILER_DIRECTIVES,
    COMPILER_CORRECTED_SOURCE,
} from '#tests/config/tools/checks/compiler-ownership.ts';

test.skipIf(!isPosix).each(['recommended', 'all'] as const)(
    '%s JavaScript uses its pinned private compiler when no project compiler exists',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { level, tables: '[agent_rules]\nenabled = false\n' }),
            'package.json': '{"private":true,"type":"module"}\n',
            'source.js': COMPILER_SOURCE,
        });
        cpSync(
            join(workspaceRoot, '.gspot/node_modules/typescript'),
            join(sandbox.path, '.gspot/node_modules/typescript'),
            { recursive: true, dereference: true },
        );
        mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
        symlinkSync('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeOutputs(session, log);
        const compiler = toolPin(session.scopes[0]!.selected, 'tsc');
        expect(inspectTool(session, compiler)).toMatchObject({
            state: 'ok',
            found: '5.9.3',
            want: '5.9.3',
            path: join(sandbox.path, '.gspot/node_modules/.bin/tsc'),
        });
        const broken = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/tsc', '--json']);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as RunReport;
        expect(report.checks).toMatchObject([
            {
                check: 'javascript/tsc',
                status: 'failed',
                findings: [
                    {
                        file: 'source.js',
                        line: 1,
                        column: 22,
                        rule: 'TS2304',
                        message: "Cannot find name 'missing'.",
                        fixable: false,
                    },
                ],
            },
        ]);
        expect(report.checks[0]!.command![0]).toBe(join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        await Bun.write(join(sandbox.path, 'source.js'), COMPILER_CORRECTED_SOURCE);
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/tsc', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'javascript/tsc', status: 'passed', findings: [] },
        ]);
    },
);

test.skipIf(!isPosix)(
    'project and snapshot compilers retain ownership while pending private installations remain explicit',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'work/package.json': '{"private":true}',
            'snapshot/.gspot/package.json': '{}',
        });
        const work = join(sandbox.path, 'work');
        const snapshot = join(sandbox.path, 'snapshot');
        cpSync(join(workspaceRoot, '.gspot/node_modules/typescript'), join(work, '.gspot/node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        mkdirSync(join(work, '.gspot/node_modules/.bin'));
        symlinkSync('../typescript/bin/tsc', join(work, '.gspot/node_modules/.bin/tsc'));
        cpSync(join(installedModules, 'typescript'), join(work, 'node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        mkdirSync(join(work, 'node_modules/.bin'));
        symlinkSync('../typescript/bin/tsc', join(work, 'node_modules/.bin/tsc'));
        const compiler = toolPin(configurationManifests().values(), 'tsc');
        const projectPath = join(work, 'node_modules/typescript/package.json');
        const project = parsePackageManifest(readFileSync(projectPath, 'utf8'), projectPath);
        expect(
            inspectTool({ root: work, inspections: new Map(), getPendingInstallations: () => ['npm'] }, compiler),
        ).toMatchObject({ state: 'host', found: project.version, path: join(work, 'node_modules/.bin/tsc') });
        expect(
            inspectTool(
                { root: snapshot, installedRoot: work, inspections: new Map(), getPendingInstallations: () => ['npm'] },
                compiler,
            ),
        ).toMatchObject({ state: 'host', found: project.version, path: join(work, 'node_modules/.bin/tsc') });
        expect(
            inspectTool({ root: snapshot, inspections: new Map(), getPendingInstallations: () => ['npm'] }, compiler),
        ).toStrictEqual({
            name: 'tsc',
            state: 'error',
            hint: 'Run: gspot install',
            note: 'Tool installation is incomplete. Run: gspot install',
        });
    },
);

test.each(['javascript', 'typescript'])(
    '%s suppression inventory agrees with native compiler directives and excludes quoted markers',
    async (language) => {
        await using sandbox = await testdir();
        const ending = language === 'javascript' ? 'js' : 'ts';
        const paths = COMPILER_DIRECTIVES.map((directive) => `${directive}.${ending}`);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([language]),
            ...Object.fromEntries(
                COMPILER_DIRECTIVES.map((directive, index) => [
                    paths[index]!,
                    `// @ts-${directive}\n${COMPILER_SOURCE}`,
                ]),
            ),
            [`control.${ending}`]: COMPILER_SOURCE,
            [`string.${ending}`]: 'export const example = "// @ts-ignore";\n',
        });
        const compiler = join(workspaceRoot, '.gspot/node_modules/typescript/bin/tsc');
        const command = [
            'node',
            compiler,
            '--noEmit',
            '--strict',
            '--allowJs',
            '--checkJs',
            '--skipLibCheck',
            ...paths,
            `control.${ending}`,
            `string.${ending}`,
        ];
        const native = await runTestCommand(command, { cwd: sandbox.path });
        expect(native.code, native.stdout + native.stderr).toBe(2);
        expect(native.stdout).toBe(`control.${ending}(1,22): error TS2304: Cannot find name 'missing'.\n`);
        const session = await openSession(sandbox.path);
        const comments = await suppressionComments(
            session.root,
            session.scopes,
            session.reads,
            session.repository.files,
        );
        expect(
            comments.map(({ file, line, form, reason, forbidden }) => ({ file, line, form, reason, forbidden })),
        ).toStrictEqual(
            paths
                .toSorted((left, right) => left.localeCompare(right))
                .map((file) => ({ file, line: 1, form: 'tsc', reason: undefined, forbidden: false })),
        );
        for (const path of [...paths, `control.${ending}`])
            await Bun.write(join(sandbox.path, path), COMPILER_CORRECTED_SOURCE);
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe('');
    },
);

test.each(['javascript', 'typescript'])(
    '%s compiler suppressions need reasons and retain their native effect after a reason is added',
    async (language) => {
        await using sandbox = await testdir();
        const ending = language === 'javascript' ? 'js' : 'ts';
        const paths = COMPILER_DIRECTIVES.map((directive) => `${directive}.${ending}`);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([language], { tables: 'require_reasons = true\n' }),
            ...Object.fromEntries(
                COMPILER_DIRECTIVES.map((directive, index) => [
                    paths[index]!,
                    `// @ts-${directive}\n${COMPILER_SOURCE}`,
                ]),
            ),
        });
        const missing = await spawnGspot(sandbox.path, ['check', '--only', 'structure/suppressions', '--json']);
        expect(missing.code, missing.stdout + missing.stderr).toBe(1);
        expect(
            (JSON.parse(missing.stdout) as RunReport).checks.flatMap(({ findings }) =>
                findings.map(({ file, line, rule }) => ({ file, line, rule })),
            ),
        ).toStrictEqual(
            paths
                .toSorted((left, right) => left.localeCompare(right))
                .map((file) => ({ file, line: 1, rule: 'tsc-no-reason' })),
        );
        for (const [index, directive] of COMPILER_DIRECTIVES.entries())
            await Bun.write(
                join(sandbox.path, paths[index]!),
                `// @ts-${directive}: ${COMPILER_REASON}\n${COMPILER_SOURCE}`,
            );
        const reasoned = await spawnGspot(sandbox.path, ['check', '--only', 'structure/suppressions', '--json']);
        expect(reasoned.code, reasoned.stdout + reasoned.stderr).toBe(0);
        const compiler = join(workspaceRoot, '.gspot/node_modules/typescript/bin/tsc');
        const accepted = await runTestCommand(
            ['node', compiler, '--noEmit', '--strict', '--allowJs', '--checkJs', '--skipLibCheck', ...paths],
            { cwd: sandbox.path },
        );
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(accepted.stdout).toBe('');
        for (const [index, directive] of COMPILER_DIRECTIVES.entries())
            expect(await Bun.file(join(sandbox.path, paths[index]!)).text()).toBe(
                `// @ts-${directive}: ${COMPILER_REASON}\n${COMPILER_SOURCE}`,
            );
    },
);

test.skipIf(!isPosix)(
    'cached private compiler inspections respect installation transitions and unrelated Python work',
    async () => {
        await using sandbox = await testdir();
        cpSync(
            join(workspaceRoot, '.gspot/node_modules/typescript'),
            join(sandbox.path, '.gspot/node_modules/typescript'),
            { recursive: true, dereference: true },
        );
        mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
        symlinkSync('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        const compiler = toolPin(configurationManifests().values(), 'tsc');
        let pending: string[] = [];
        const search = { root: sandbox.path, inspections: new Map(), getPendingInstallations: () => pending };
        expect(inspectTool(search, compiler)).toMatchObject({ state: 'ok', found: '5.9.3' });
        pending = ['npm'];
        expect(inspectTool(search, compiler)).toStrictEqual({
            name: 'tsc',
            state: 'error',
            hint: 'Run: gspot install',
            note: 'Tool installation is incomplete. Run: gspot install',
        });
        pending = [];
        expect(inspectTool(search, compiler)).toMatchObject({ state: 'ok', found: '5.9.3' });
        pending = ['python'];
        expect(inspectTool(search, compiler)).toMatchObject({ state: 'ok', found: '5.9.3' });
        await createFileTree(sandbox.path, { 'snapshot/.gspot/package.json': '{}' });
        expect(
            inspectTool(
                {
                    root: join(sandbox.path, 'snapshot'),
                    installedRoot: sandbox.path,
                    inspections: new Map(),
                    getPendingInstallations: () => pending,
                },
                compiler,
            ),
        ).toMatchObject({ state: 'ok', found: '5.9.3', path: join(sandbox.path, '.gspot/node_modules/.bin/tsc') });
    },
);
