import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { asOwner } from '#cli/lifecycle/ownership/owner.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PACKAGE_PROJECTS, readPackageInputs, createPackageProject } from '#tests/harness/tools/npm.ts';

test.each([PACKAGE_PROJECTS[0]])(
    '%s from %s with %s refuses lifecycle scripts before contacting the registry',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, registry } = fixture;
        const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await writeOutputs(await openSession(root));
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
        expect(await rejection(asOwner(root, (owner) => installPackageProject(root, owner, tools)))).toContain(
            'scripts',
        );
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
    const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
    await writeOutputs(await openSession(root));
    const { lockPath, lock } = readPackageInputs(root, 'npm');
    const original = spawn.run;
    const initialize = spyOn(spawn, 'run').mockImplementation(async (argv, options) => {
        if (/(?:editorconfig-checker|[\\/]ec(?:\.cmd)?$)/u.test(argv[0] ?? ''))
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
        expect(await rejection(asOwner(root, (owner) => installPackageProject(root, owner, tools)))).toContain(
            'Native wrapper download failed',
        );
        expect(existsSync(join(root, '.gspot/node_modules/prettier'))).toBe(false);
        expect(readFileSync(lockPath)).toStrictEqual(lock);
    } finally {
        initialize.mockRestore();
    }
}, 120_000);

test('a reinstall the registry answers with 404 keeps the working tools and leaves no scratch folder', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'mise');
    const { root, registry } = fixture;
    const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
    await writeOutputs(await openSession(root));
    await asOwner(root, (owner) => installPackageProject(root, owner, tools));
    const prettier = join(root, '.gspot/node_modules/prettier/bin/prettier.cjs');
    const { lockPath, lock } = readPackageInputs(root, 'npm');
    // The changed pin names a tarball the registry does not have, under an integrity no cache holds.
    const missing = createHash('sha512').update('missing tarball').digest('base64');
    const changed = lock
        .toString('utf8')
        .replace(`${registry.url}/prettier.tgz`, `${registry.url}/prettier-missing.tgz`)
        .replace(/"integrity": "sha512-[^"]+"/u, `"integrity": "sha512-${missing}"`);
    chmodSync(lockPath, 0o644);
    writeFileSync(lockPath, changed);
    chmodSync(lockPath, 0o444);
    const before = readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-install-'));
    expect(await rejection(asOwner(root, (owner) => installPackageProject(root, owner, tools)))).toContain(
        'immutable installation failed',
    );
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-install-'))).toStrictEqual(before);
    const version = await spawn.run([process.execPath, prettier, '--version'], { cwd: root });
    expect(version.stdout.trim()).toBe('3.8.1');
}, 120_000);
