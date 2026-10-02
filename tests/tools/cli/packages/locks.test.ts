import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { LOCKS } from '#cli/config/tools/packages.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitted } from '#tests/harness/cli/generated.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { asOwner } from '#cli/lifecycle/ownership/owner.ts';
import { gspot as CLI } from '#tests/harness/cli/command.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { PACKAGE_PROJECTS, readPackageInputs, createPackageProject } from '#tests/harness/tools/npm.ts';

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s refuses stale locks without changing ownership and reports drift',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, registry } = fixture;
        const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await writeOutputs(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        const { lockPath, lock, ownershipPath, ownership } = readPackageInputs(root, client);
        const preview = await run([process.execPath, CLI, 'install', '--dry-run', '--json'], {
            cwd: root,
        });
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as InstallJson).dryRun).toBe(true);
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
        expect((JSON.parse(refused.stdout) as InstallJson).message).toContain('Run: gspot apply, then gspot install');
        expect(await rejection(asOwner(root, (owner) => installPackageProject(root, owner, tools)))).toContain(
            'Run: gspot apply, then gspot install',
        );
        expect(readFileSync(lockPath, 'utf8')).toBe(stale);
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        const read = await openSession(root);
        expect(computeDrift(read.root, read.policyFiles.policy, emitted(read))).toContainEqual({
            path: `.gspot/${LOCKS[client]}`,
            kind: 'changed',
        });
    },
    120_000,
);
test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s leaves a lock conflict until the package manager pin is corrected, then regenerates the lock',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, rootPackage } = fixture;
        const first = await writeOutputs(await openSession(root));
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
        expect(await rejection(writeOutputs(await openSession(root)))).toContain(
            'Install that package manager version first',
        );
        expect(readFileSync(lockPath, 'utf8')).toBe(conflict);
        expect(readFileSync(join(root, '.gspot/package.json'))).toStrictEqual(manifest);
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        writeFileSync(join(root, projectPath), rootPackage);
        const repaired = await writeOutputs(await openSession(root));
        expect(repaired.written).toContain(`.gspot/${LOCKS[client]}`);
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(readFileSync(lockPath, 'utf8')).not.toContain('<<<<<<<');
    },
    120_000,
);
