import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { cp, mkdir, symlink, readFile } from 'node:fs/promises';
import { installedModules } from '#tests/harness/environment.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { COMPILER_SOURCE } from '#tests/config/samples/typescript.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { parsePackageManifest } from '#cli/parsers/packages/public.ts';
import { COMPILER_CORRECTED_SOURCE } from '#tests/config/tools/configurations/language/javascript/compiler-ownership.ts';

test.skipIf(!isPosix).each(['recommended', 'all'] as const)(
    '%s JavaScript uses its pinned private compiler when no project compiler exists',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { level, tables: '[agent_rules]\nenabled = false\n' }),
            'package.json': '{"private":true,"type":"module"}\n',
            'source.js': COMPILER_SOURCE,
        });
        await cp(join(installedModules, 'typescript'), join(sandbox.path, '.gspot/node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
        await symlink('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
        const compiler = toolPin(session.scopes[0]!.selected, 'tsc');
        expect(inspectTool(session, compiler)).toMatchObject({
            state: 'ok',
            found: compiler.version,
            want: compiler.version,
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
        await cp(join(installedModules, 'typescript'), join(work, '.gspot/node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        await mkdir(join(work, '.gspot/node_modules/.bin'));
        await symlink('../typescript/bin/tsc', join(work, '.gspot/node_modules/.bin/tsc'));
        await cp(join(installedModules, 'typescript'), join(work, 'node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        await mkdir(join(work, 'node_modules/.bin'));
        await symlink('../typescript/bin/tsc', join(work, 'node_modules/.bin/tsc'));
        const compiler = toolPin(configurationManifests().values(), 'tsc');
        const projectPath = join(work, 'node_modules/typescript/package.json');
        const project = parsePackageManifest(await readFile(projectPath, 'utf8'), projectPath);
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

test.skipIf(!isPosix)(
    'cached private compiler inspections respect installation transitions and unrelated Python work',
    async () => {
        await using sandbox = await testdir();
        await cp(join(installedModules, 'typescript'), join(sandbox.path, '.gspot/node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
        await symlink('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        const compiler = toolPin(configurationManifests().values(), 'tsc');
        let pending: string[] = [];
        const search = { root: sandbox.path, inspections: new Map(), getPendingInstallations: () => pending };
        expect(inspectTool(search, compiler)).toMatchObject({ state: 'ok', found: compiler.version });
        pending = ['npm'];
        expect(inspectTool(search, compiler)).toStrictEqual({
            name: 'tsc',
            state: 'error',
            hint: 'Run: gspot install',
            note: 'Tool installation is incomplete. Run: gspot install',
        });
        pending = [];
        expect(inspectTool(search, compiler)).toMatchObject({ state: 'ok', found: compiler.version });
        pending = ['python'];
        expect(inspectTool(search, compiler)).toMatchObject({ state: 'ok', found: compiler.version });
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
        ).toMatchObject({
            state: 'ok',
            found: compiler.version,
            path: join(sandbox.path, '.gspot/node_modules/.bin/tsc'),
        });
    },
);
