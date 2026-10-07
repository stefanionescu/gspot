import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/outputs.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { packageLockFile } from '#cli/parsers/packages.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import type { ApplyReport } from '#cli/types/lifecycle/output.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_REGISTRY_TOKEN } from '#tests/config/harness/registry.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';

test.each(PACKAGE_PROJECTS.filter(([, path, runner]) => path === 'package.json' && runner === 'mise'))(
    '%s from %s with %s previews stale lock repair without writing, then installs the repaired lock',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, registry } = fixture;
        const { lockPath, lock, ownershipPath, ownership } = readPackageInputs(root, installer);
        const preview = await spawnGspot(root, ['install', '--dry-run', '--json']);
        expect(
            {
                code: preview.code,
                dryRun: (JSON.parse(preview.stdout) as InstallJson).dryRun,
                ownership: readFileSync(ownershipPath),
                includesCredentials: lock.toString('utf8').includes(PACKAGE_REGISTRY_TOKEN),
            },
            preview.stdout + preview.stderr,
        ).toStrictEqual({ code: 0, dryRun: true, ownership, includesCredentials: false });
        for (let attempt = 0; attempt < 2; attempt++) {
            const applied = await spawnGspot(root, ['apply', '--json']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(readFileSync(lockPath)).toStrictEqual(lock);
        }
        // Yarn 1 writes resolved URLs into its lock; the private registry must not be among them.
        expect(
            installer === 'yarn' && fixture.version.startsWith('1.') && lock.toString('utf8').includes(registry.url),
        ).toBe(false);
        const stale = lock.toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        chmodSync(lockPath, 0o644);
        writeFileSync(lockPath, stale);
        const staleApply = await spawnGspot(root, ['apply', '--json']);
        expect(staleApply.code, staleApply.stdout + staleApply.stderr).toBe(0);
        expect(readFileSync(lockPath, 'utf8')).toBe(stale);
        const proposed = await spawnGspot(root, ['install', '--dry-run', '--json']);
        expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
        const repair = JSON.parse(proposed.stdout) as InstallJson;
        expect({ dryRun: repair.dryRun, hasSteps: repair.steps!.length > 0 }).toStrictEqual({
            dryRun: true,
            hasSteps: true,
        });
        expect({ lock: readFileSync(lockPath, 'utf8'), ownership: readFileSync(ownershipPath) }).toStrictEqual({
            lock: stale,
            ownership,
        });
        const read = await openSession(root);
        expect(computeDrift(read.root, read.policyFiles.policy, emitAll(read))).toContainEqual({
            path: `.gspot/${packageLockFile(installer)}`,
            kind: 'changed',
        });
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout) as InstallJson).toMatchObject({ installed: true, steps: repair.steps });
        expect(readFileSync(lockPath)).toStrictEqual(lock);
        const repaired = await openSession(root);
        expect(computeDrift(root, repaired.policyFiles.policy, emitAll(repaired))).not.toContainEqual({
            path: `.gspot/${packageLockFile(installer)}`,
            kind: 'changed',
        });
    },
    NATIVE_TEST_TIMEOUT_MS,
);
test.each(PACKAGE_PROJECTS.filter(([, path, runner]) => path === 'package.json' && runner === 'mise'))(
    '%s from %s with %s keeps a conflicting lock through apply until the manager pin is corrected and install repairs it',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, rootPackage } = fixture;
        const { manifest, lockPath, lock, ownershipPath, ownership } = readPackageInputs(root, installer);
        const stale = lock.toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        chmodSync(lockPath, 0o644);
        const conflict = `<<<<<<< edited\n${stale}\n=======\n${lock.toString('utf8')}\n>>>>>>> generated\n`;
        writeFileSync(lockPath, conflict);
        writeFileSync(
            join(root, projectPath),
            JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${installer}@99.0.0` }),
        );
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout).toContain('Install that package manager version first');
        expect(readFileSync(lockPath, 'utf8')).toBe(conflict);
        expect(readFileSync(join(root, '.gspot/package.json'))).toStrictEqual(manifest);
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        writeFileSync(join(root, projectPath), rootPackage);
        let repaired: ApplyReport;
        {
            using log = openOwnership(root);
            repaired = writeOutputs(await openSession(root), log);
        }
        expect(repaired.written).not.toContain(`.gspot/${packageLockFile(installer)}`);
        expect(readFileSync(lockPath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout) as InstallJson).toMatchObject({ installed: true });
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(readFileSync(lockPath, 'utf8')).not.toContain('<<<<<<<');
    },
    NATIVE_TEST_TIMEOUT_MS,
);
