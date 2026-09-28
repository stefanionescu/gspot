import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { rejection } from '#tests/support/expectations.ts';
import { gspot as CLI } from '#tests/support/cli/command.ts';
import type { InstallJson } from '#cli/types/commands/commands.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { chmodSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LOCKS, PACKAGE_PROJECTS } from '#tests/config/integration/tools/packages.ts';
import { readPackageInputs, createPackageProject } from '#tests/support/cli/package-project.ts';

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s refuses stale locks without changing ownership and reports drift',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, registry } = fixture;
        const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await applyAll(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        const { lockPath, lock, ownershipPath, ownership } = readPackageInputs(root, client);
        const preview = await run([process.execPath, CLI, 'install', '--dry-run', '--json'], {
            cwd: root,
        });
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as InstallJson).isDryRun).toBe(true);
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        expect(lock.toString('utf8')).not.toContain(registry.token);
        // Yarn 1 writes resolved URLs into its lock; the private registry must not be among them.
        const isYarnOne = client === 'yarn' && fixture.version.startsWith('1.');
        expect(isYarnOne && lock.toString('utf8').includes(registry.url)).toBe(false);
        const stale = lock.toString('utf8').replaceAll('3.8.1', '0.0.0');
        chmodSync(lockPath, 0o644);
        writeFileSync(lockPath, stale);
        const refused = await run([process.execPath, CLI, 'install', '--dry-run', '--json'], {
            cwd: root,
        });
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect((JSON.parse(refused.stdout) as InstallJson).error).toContain('Run: gspot apply, then gspot install');
        expect(await rejection(installPackageProject(root, tools))).toContain('Run: gspot apply, then gspot install');
        expect(readFileSync(lockPath, 'utf8')).toBe(stale);
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        const observed = await openSession(root);
        expect(
            computeDrift(
                observed.root,
                observed.policyFiles.policy,
                observed.packageClient !== undefined,
                emitAll(observed.policyFiles.policy, observed.repository, observed.scopes, {
                    version: observed.version,
                    packageClient: observed.packageClient,
                }),
            ),
        ).toContainEqual({
            path: `.gspot/${LOCKS[client]}`,
            kind: 'changed',
        });
    },
    120_000,
);
test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s preserves lock conflicts until the package manager pin is corrected',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, rootPackage } = fixture;
        const first = await applyAll(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        const { manifest, lockPath, lock, ownershipPath, ownership } = readPackageInputs(root, client);
        const stale = lock.toString('utf8').replaceAll('3.8.1', '0.0.0');
        chmodSync(lockPath, 0o644);
        const conflict = `<<<<<<< edited
${stale}
=======
${lock.toString('utf8')}
>>>>>>> generated
`;
        writeFileSync(lockPath, conflict);
        writeFileSync(
            join(root, projectPath),
            JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${client}@99.0.0` }),
        );
        expect(await rejection(applyAll(await openSession(root)))).toContain(
            'Install that package manager version first',
        );
        expect(readFileSync(lockPath, 'utf8')).toBe(conflict);
        expect(readFileSync(join(root, '.gspot/package.json'))).toStrictEqual(manifest);
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        writeFileSync(join(root, projectPath), rootPackage);
        const repaired = await applyAll(await openSession(root));
        expect(repaired.written).toContain(`.gspot/${LOCKS[client]}`);
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        const recovery = join(root, '.gspot/state/recovery');
        expect(
            readdirSync(recovery, { recursive: true })
                .filter((path) => String(path).endsWith('.original'))
                .some((path) => readFileSync(join(recovery, String(path)), 'utf8') === conflict),
        ).toBe(true);
    },
    120_000,
);
