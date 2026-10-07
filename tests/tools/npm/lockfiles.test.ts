import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/outputs.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { packageLockfile } from '#cli/parsers/packages.ts';
import { prepareToolProjects } from '#cli/tools/project.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { ApplyReport } from '#cli/types/lifecycle/apply.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_REGISTRY_TOKEN } from '#tests/config/harness/registry.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';

// Resolve normal immutable inputs without installing an environment before either repair journey.
async function prepareLockfile(root: string): Promise<void> {
    using log = openOwnership(root);
    const session = await openSession(root);
    const generated = emitAll(session);
    await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    writeOutputs(session, log, undefined, generated);
}

test.each(PACKAGE_PROJECTS.filter(([, path, runner]) => path === 'package.json' && runner === 'mise'))(
    '%s from %s with %s previews lockfile drift repair without writing, then installs the repaired lockfile',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, registry } = fixture;
        await prepareLockfile(root);
        const { lockfilePath, lockfile, ownershipPath, ownership } = readPackageInputs(root, installer);
        const preview = await spawnGspot(root, ['install', '--dry-run', '--json']);
        expect(
            {
                code: preview.code,
                dryRun: (JSON.parse(preview.stdout) as InstallJson).dryRun,
                ownership: readFileSync(ownershipPath),
                includesCredentials: lockfile.toString('utf8').includes(PACKAGE_REGISTRY_TOKEN),
            },
            preview.stdout + preview.stderr,
        ).toStrictEqual({ code: 0, dryRun: true, ownership, includesCredentials: false });
        for (let attempt = 0; attempt < 2; attempt++) {
            const applied = await spawnGspot(root, ['apply', '--json']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
        }
        // Yarn 1 writes resolved URLs into its lockfile; the private registry must not be among them.
        expect(
            installer === 'yarn' &&
                fixture.version.startsWith('1.') &&
                lockfile.toString('utf8').includes(registry.url),
        ).toBe(false);
        const stale = lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        chmodSync(lockfilePath, 0o644);
        writeFileSync(lockfilePath, stale);
        const staleApply = await spawnGspot(root, ['apply', '--json']);
        expect(staleApply.code, staleApply.stdout + staleApply.stderr).toBe(0);
        expect(readFileSync(lockfilePath, 'utf8')).toBe(stale);
        const proposed = await spawnGspot(root, ['install', '--dry-run', '--json']);
        expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
        const repair = JSON.parse(proposed.stdout) as InstallJson;
        expect({ dryRun: repair.dryRun, hasSteps: repair.steps!.length > 0 }).toStrictEqual({
            dryRun: true,
            hasSteps: true,
        });
        expect({ lockfile: readFileSync(lockfilePath, 'utf8'), ownership: readFileSync(ownershipPath) }).toStrictEqual({
            lockfile: stale,
            ownership,
        });
        const read = await openSession(root);
        expect(computeDrift(read.root, read.policyFiles.policy, emitAll(read))).toContainEqual({
            path: `.gspot/${packageLockfile(installer)}`,
            kind: 'changed',
        });
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout) as InstallJson).toMatchObject({ installed: true, steps: repair.steps });
        expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
        const repaired = await openSession(root);
        expect(computeDrift(root, repaired.policyFiles.policy, emitAll(repaired))).not.toContainEqual({
            path: `.gspot/${packageLockfile(installer)}`,
            kind: 'changed',
        });
    },
    NATIVE_TEST_TIMEOUT_MS,
);
test.each(PACKAGE_PROJECTS.filter(([, path, runner]) => path === 'package.json' && runner === 'mise'))(
    '%s from %s with %s keeps a conflicting lockfile through apply until the manager pin is corrected and install repairs it',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, rootPackage } = fixture;
        await prepareLockfile(root);
        const { manifest, lockfilePath, lockfile, ownershipPath, ownership } = readPackageInputs(root, installer);
        const stale = lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        chmodSync(lockfilePath, 0o644);
        const conflict = `<<<<<<< edited\n${stale}\n=======\n${lockfile.toString('utf8')}\n>>>>>>> generated\n`;
        writeFileSync(lockfilePath, conflict);
        writeFileSync(
            join(root, projectPath),
            JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${installer}@99.0.0` }),
        );
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout).toContain('Install that package manager version first');
        expect(readFileSync(lockfilePath, 'utf8')).toBe(conflict);
        expect(readFileSync(join(root, '.gspot/package.json'))).toStrictEqual(manifest);
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        writeFileSync(join(root, projectPath), rootPackage);
        let repaired: ApplyReport;
        {
            using log = openOwnership(root);
            repaired = writeOutputs(await openSession(root), log);
        }
        expect(repaired.written).not.toContain(`.gspot/${packageLockfile(installer)}`);
        expect(readFileSync(lockfilePath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout) as InstallJson).toMatchObject({ installed: true });
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(readFileSync(lockfilePath, 'utf8')).not.toContain('<<<<<<<');
    },
    NATIVE_TEST_TIMEOUT_MS,
);
