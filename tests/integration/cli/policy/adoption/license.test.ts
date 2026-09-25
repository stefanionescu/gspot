import { proposeText } from '#cli/commands/init/propose.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';
import { expect, test } from 'bun:test';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const tooling: ExistingTooling = {
    configs: [{ tool: 'license-checker-rseidelsohn', path: '.license-checker.json', carries: 'licenses' as const }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};
const scanner = join(import.meta.dir, '../../../../../node_modules/license-checker-rseidelsohn');
const allowed = configurationManifests()
    .get('licenses')!
    .settings.find((setting) => setting.name === 'tools.licenses.licenses_allowed')!.default as string[];

test.each(['root', 'nested'])(
    'license adoption at %s records native identities and refuses unresolved exclusions',
    async (scope) => {
        await using sandbox = await testdir();
        const project = join(sandbox.path, 'project');
        const root = scope === 'root' ? project : sandbox.path;
        const path = scope === 'root' ? '.license-checker.json' : 'project/.license-checker.json';
        const selected = { ...tooling, configs: tooling.configs.map((entry) => ({ ...entry, path })) };
        const original =
            JSON.stringify({ excludePackages: 'example-dependency;missing-dependency', onlyAllow: allowed.join(';') }) +
            '\n';
        await createFileTree(sandbox.path, {
            'project/.license-checker.json': original,
            'package.json': JSON.stringify({
                private: true,
                devDependencies: { 'license-checker-rseidelsohn': '5.0.1' },
            }),
            'project/package.json': JSON.stringify({
                name: 'example-project',
                version: '1.0.0',
                private: true,
                dependencies: { 'example-dependency': '1.2.3', 'missing-dependency': '2.0.0' },
            }),
            'project/node_modules/example-dependency/package.json': JSON.stringify({
                name: 'example-dependency',
                version: '1.2.3',
                license: 'GPL-3.0-only',
            }),
        });
        mkdirSync(join(sandbox.path, 'node_modules'));
        symlinkSync(scanner, join(sandbox.path, 'node_modules/license-checker-rseidelsohn'));
        const installed = (await Bun.file(join(scanner, 'package.json')).json()) as { version: string };
        expect(installed.version).toBe(configurationManifests().get('licenses')!.tools[0]!.version!);
        const refused = await collectCarried(root, selected, new Set(['licenses']), []);
        expect(refused.unread.map((entry) => entry.path)).toStrictEqual([path]);
        expect(refused.tools.size).toBe(0);
        expect(refused.scopes.size).toBe(0);
        expect(refused.removed).toStrictEqual([]);
        expect(await Bun.file(join(root, path)).text()).toBe(original);
        await Bun.write(
            join(project, 'node_modules/missing-dependency/package.json'),
            JSON.stringify({ name: 'missing-dependency', version: '2.0.0', license: 'MPL-2.0' }),
        );
        const carried = await collectCarried(root, selected, new Set(['licenses']), []);
        expect(carried.unread).toStrictEqual([]);
        expect(
            scope === 'root'
                ? carried.tools.get('licenses')?.settings
                : carried.scopes.get('project')?.tools['licenses'],
        ).toStrictEqual({
            licenses_allowed: allowed,
            packages_allowed: [
                { package: 'example-dependency@1.2.3', license: 'GPL-3.0-only', reason: expect.any(String) },
                { package: 'missing-dependency@2.0.0', license: 'MPL-2.0', reason: expect.any(String) },
            ],
        });
        if (scope === 'nested') {
            expect(carried.tools.size).toBe(0);
            expect(carried.scopes.get('project')?.configurations).toStrictEqual(['licenses']);
            await Bun.write(
                join(root, 'gspot.toml'),
                proposeText({
                    configurations: [],
                    scopes: [{ path: 'sibling', configurations: ['licenses'] }],
                    carried,
                    hooks: 'none',
                    ci: 'none',
                    rules: false,
                    runner: 'none',
                }),
            );
            await Bun.write(join(root, 'sibling/package.json'), '{"private":true}');
            const session = await openSession(root);
            const emitted = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
                version: session.version,
                packageManager: session.packageManager,
            }).files;
            const projectConfig = emitted.find((file) => file.path === '.gspot/config/project/licenses.json')!;
            const siblingConfig = emitted.find((file) => file.path === '.gspot/config/sibling/licenses.json')!;
            expect(JSON.parse(projectConfig.content).packages_allowed).toHaveLength(2);
            expect(JSON.parse(siblingConfig.content).packages_allowed).toStrictEqual([]);
        }
        expect(carried.removed.map((entry) => entry.path)).toStrictEqual([path]);
        expect(await Bun.file(join(root, path)).text()).toBe(original);
    },
);

test.each(['MIT*;Public Domain', 'MIT OR ISC', 'MIT;ISC'])(
    'license adoption retains unsupported allowance %s',
    async (allowance) => {
        await using sandbox = await testdir();
        const original = JSON.stringify({ onlyAllow: allowance }) + '\n';
        await createFileTree(sandbox.path, { '.license-checker.json': original });
        const carried = await collectCarried(sandbox.path, tooling, new Set(['licenses']), []);
        expect(carried.unread.map((entry) => entry.path)).toStrictEqual(['.license-checker.json']);
        expect(carried.tools.size).toBe(0);
        expect(carried.removed).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, '.license-checker.json')).text()).toBe(original);
        await Bun.write(join(sandbox.path, '.license-checker.json'), JSON.stringify({ onlyAllow: allowed.join(';') }));
        const corrected = await collectCarried(sandbox.path, tooling, new Set(['licenses']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.tools.get('licenses')?.settings).toStrictEqual({ licenses_allowed: allowed });
    },
);

test('overlapping license configurations remain intact without widening nested allowances', async () => {
    await using sandbox = await testdir();
    const files = {
        '.license-checker.json': JSON.stringify({ onlyAllow: [...allowed, 'MPL-2.0'].join(';') }),
        'nested/.license-checker.json': JSON.stringify({ onlyAllow: allowed.join(';') }),
    };
    await createFileTree(sandbox.path, files);
    const discovered = {
        ...tooling,
        configs: Object.keys(files).map((path) => ({
            tool: 'license-checker-rseidelsohn',
            path,
            carries: 'licenses' as const,
        })),
    };
    const carried = await collectCarried(sandbox.path, discovered, new Set(['licenses']), []);
    expect(carried.unread.map(({ path }) => path)).toContain('.license-checker.json');
    expect(carried.removed).toStrictEqual([]);
    expect(carried.tools.size).toBe(0);
    expect(carried.scopes.size).toBe(0);
    for (const [path, original] of Object.entries(files))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
});
