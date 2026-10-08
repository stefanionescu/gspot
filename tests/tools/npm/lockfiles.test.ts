import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { prepareToolProjects } from '#cli/tools/public.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import type { ApplyReport } from '#cli/types/lifecycle/apply.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { packageLockfile } from '#cli/parsers/packages/contracts.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_REGISTRY_TOKEN } from '#tests/config/harness/registry.ts';
import { computeDrift, writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';

// Resolve normal immutable inputs without installing an environment before either repair journey.
async function prepareLockfile(root: string): Promise<void> {
    using log = openOwnership(root);
    const session = await openSession(root);
    const generated = emitAll(session);
    await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    writeGeneratedFiles(session, generated, log);
}

test.each(PACKAGE_PROJECTS.filter(([, path, runner]) => path === 'package.json' && runner === 'mise'))(
    '%s from %s with %s previews lockfile drift repair without writing, then installs the repaired lockfile',
    async (installer, projectPath, runner) => {
        await using sandbox = await createPackageProject(installer, projectPath, runner);
        const { root, registry } = sandbox;
        await prepareLockfile(root);
        const { lockfilePath, lockfile, ownershipPath, ownership } = await readPackageInputs(root, installer);
        const preview = await spawnGspot(root, ['install', '--dry-run', '--json']);
        expect(
            {
                code: preview.code,
                dryRun: (JSON.parse(preview.stdout) as InstallJson).dryRun,
                ownership: await readFile(ownershipPath),
                includesCredentials: lockfile.toString('utf8').includes(PACKAGE_REGISTRY_TOKEN),
            },
            preview.stdout + preview.stderr,
        ).toStrictEqual({ code: 0, dryRun: true, ownership, includesCredentials: false });
        for (let attempt = 0; attempt < 2; attempt++) {
            const applied = await spawnGspot(root, ['apply', '--json']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
        }
        // Yarn 1 writes resolved URLs into its lockfile; the private registry must not be among them.
        if (installer === 'yarn') expect(lockfile.toString('utf8')).not.toContain(registry.url);
        const stale = lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        await writeFile(lockfilePath, stale);
        const staleApply = await spawnGspot(root, ['apply', '--json']);
        expect(staleApply.code, staleApply.stdout + staleApply.stderr).toBe(0);
        expect(await readFile(lockfilePath, 'utf8')).toBe(stale);
        const proposed = await spawnGspot(root, ['install', '--dry-run', '--json']);
        expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
        const repair = JSON.parse(proposed.stdout) as InstallJson;
        expect({ dryRun: repair.dryRun, hasSteps: repair.steps!.length > 0 }).toStrictEqual({
            dryRun: true,
            hasSteps: true,
        });
        expect({
            lockfile: await readFile(lockfilePath, 'utf8'),
            ownership: await readFile(ownershipPath),
        }).toStrictEqual({
            lockfile: stale,
            ownership,
        });
        const read = await openSession(root);
        expect(computeDrift(read.root, emitAll(read))).toContainEqual({
            path: `.gspot/${packageLockfile(installer)}`,
            kind: 'changed',
        });
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout) as InstallJson).toMatchObject({ installed: true, steps: repair.steps });
        expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
        const repaired = await openSession(root);
        expect(computeDrift(root, emitAll(repaired))).not.toContainEqual({
            path: `.gspot/${packageLockfile(installer)}`,
            kind: 'changed',
        });
    },
);
test.each(PACKAGE_PROJECTS.filter(([, path, runner]) => path === 'package.json' && runner === 'mise'))(
    '%s from %s with %s keeps a conflicting lockfile through apply until the manager pin is corrected and install repairs it',
    async (installer, projectPath, runner) => {
        await using sandbox = await createPackageProject(installer, projectPath, runner);
        const { root, rootPackage } = sandbox;
        await prepareLockfile(root);
        const { manifest, lockfilePath, lockfile, ownershipPath, ownership } = await readPackageInputs(root, installer);
        const stale = lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        const conflict = `<<<<<<< edited\n${stale}\n=======\n${lockfile.toString('utf8')}\n>>>>>>> generated\n`;
        await writeFile(lockfilePath, conflict);
        await writeFile(
            join(root, projectPath),
            JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${installer}@99.0.0` }),
        );
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout).toContain('Install that package manager version first');
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        expect(await readFile(join(root, '.gspot/package.json'))).toStrictEqual(manifest);
        expect(await readFile(ownershipPath)).toStrictEqual(ownership);
        await writeFile(join(root, projectPath), rootPackage);
        let repaired: ApplyReport;
        {
            using log = openOwnership(root);
            const session = await openSession(root);
            repaired = writeGeneratedFiles(session, emitAll(session), log);
        }
        expect(repaired.written).not.toContain(`.gspot/${packageLockfile(installer)}`);
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout) as InstallJson).toMatchObject({ installed: true });
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(await readFile(lockfilePath, 'utf8')).not.toContain('<<<<<<<');
    },
);
