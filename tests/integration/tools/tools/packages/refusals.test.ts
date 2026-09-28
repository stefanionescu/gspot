import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { rejection } from '#tests/support/expectations.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PACKAGE_PROJECTS } from '#tests/constants/integration/tools/packages.ts';
import { createPackageProject, readPackageInputs } from '#tests/support/cli/package-project.ts';

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s refuses lifecycle scripts before contacting the registry',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, registry } = fixture;
        const tools = [...configurationManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await applyAll(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        const { manifest } = readPackageInputs(root, client);
        const manifestPath = join(root, '.gspot/package.json');
        chmodSync(manifestPath, 0o644);
        const hasScript = JSON.stringify({
            ...JSON.parse(manifest.toString('utf8')),
            scripts: { postinstall: 'exit 42' },
        });
        writeFileSync(manifestPath, hasScript);
        const requestsBefore = registry.requests;
        expect(await rejection(installPackageProject(root, tools))).toContain('scripts');
        expect(registry.requests).toBe(requestsBefore);
        expect(readFileSync(manifestPath, 'utf8')).toBe(hasScript);
        writeFileSync(manifestPath, manifest);
        chmodSync(manifestPath, 0o444);
    },
    120_000,
);
test('native wrapper download failure preserves the lock and publishes no partial installation', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'none');
    const { root } = fixture;
    const tools = [...configurationManifests().values()].flatMap((manifest) => manifest.tools);
    await applyAll(await openSession(root));
    const { lockPath, lock } = readPackageInputs(root, 'npm');
    const original = spawn.run;
    const initialize = spyOn(spawn, 'run').mockImplementation(async (argv, options) => {
        if (argv[0]?.includes('editorconfig-checker') === true)
            return {
                code: 7,
                stdout: '',
                stderr: 'Native wrapper download failed',
                missing: false,
                duration: 1,
            };
        return original(argv, options);
    });
    try {
        expect(await rejection(installPackageProject(root, tools))).toContain('Native wrapper download failed');
        expect(existsSync(join(root, '.gspot/node_modules/prettier'))).toBe(false);
        expect(readFileSync(lockPath)).toStrictEqual(lock);
    } finally {
        initialize.mockRestore();
    }
}, 120_000);
