import * as spawn from '#cli/platform/spawn.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { expect, spyOn, test } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/run/session.ts';
import { applyAll } from '#cli/lifecycle/apply.ts';
import { probeTool } from '#cli/tools/tool-probe.ts';
import { computeDrift } from '#cli/emit/drift.ts';
import { installPackageProject } from '#cli/tools/package-project.ts';

const CLI = fileURLToPath(new URL('../../../packages/cli/src/main.ts', import.meta.url));

const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;

test.each([
    ['npm', 'package.json', 'mise'],
    ['bun', 'package.json', 'mise'],
    ['pnpm', 'package.json', 'mise'],
    ['yarn', 'package.json', 'mise'],
    ['npm', 'apps/web/package.json', 'mise'],
    ['npm', 'package.json', 'none'],
] as const)(
    '%s from %s with %s integration installs the pinned formatter from an authenticated registry without changing the repository dependencies or locked inputs',
    async (manager, projectPath, runner) => {
        const tools = [...configurationManifests().values()].flatMap((manifest) => manifest.tools);
        await using repository = await testdir();
        await using artifacts = await testdir();
        const version = await run([manager, '--version'], { cwd: artifacts.path, timeoutMs: 15000 });
        expect(version.code, version.stdout + version.stderr).toBe(0);
        const packed = await run(
            [
                'npm',
                'pack',
                dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))),
                '--ignore-scripts',
                '--json',
                '--pack-destination',
                artifacts.path,
            ],
            { cwd: artifacts.path, timeoutMs: 30000 },
        );
        expect(packed.code, packed.stdout + packed.stderr).toBe(0);
        const archive = readFileSync(join(artifacts.path, JSON.parse(packed.stdout)[0].filename));
        const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
        const packages = new Map<
            string,
            { version: string; bin: Record<string, string>; archive: Buffer; integrity: string }
        >([['prettier', { version: '3.8.1', bin: { prettier: 'bin/prettier.cjs' }, archive, integrity }]]);
        if (runner === 'none') {
            const checker = await run(
                [
                    'npm',
                    'pack',
                    'editorconfig-checker@7.0.0',
                    '--ignore-scripts',
                    '--json',
                    '--pack-destination',
                    artifacts.path,
                ],
                { cwd: artifacts.path, timeoutMs: 30000 },
            );
            expect(checker.code, checker.stdout + checker.stderr).toBe(0);
            const checkerArchive = readFileSync(join(artifacts.path, JSON.parse(checker.stdout)[0].filename));
            packages.set('editorconfig-checker', {
                version: '7.0.0',
                bin: { ec: 'dist/index.js', 'editorconfig-checker': 'dist/index.js' },
                archive: checkerArchive,
                integrity: `sha512-${createHash('sha512').update(checkerArchive).digest('base64')}`,
            });
        }
        const token = 'synthetic-package-install-token';
        let requests = 0;
        const previousCache = process.env['YARN_CACHE_FOLDER'];
        const previousGlobal = process.env['YARN_GLOBAL_FOLDER'];
        if (manager === 'yarn') process.env['YARN_GLOBAL_FOLDER'] = join(artifacts.path, 'resolution-global');
        if (manager === 'yarn') process.env['YARN_CACHE_FOLDER'] = join(artifacts.path, 'resolution-cache');
        const server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch(request) {
                requests++;
                if (request.headers.get('authorization') !== `Bearer ${token}`)
                    return Response.json({ error: 'Authentication required' }, { status: 401 });
                const url = new URL(request.url);
                const name = url.pathname.slice(1).replace(/\.tgz$/u, '');
                const entry = packages.get(name);
                if (entry === undefined) return Response.json({ error: 'Package not found' }, { status: 404 });
                if (url.pathname.endsWith('.tgz')) return new Response(new Uint8Array(entry.archive));
                return Response.json({
                    name,
                    'dist-tags': { latest: entry.version },
                    versions: {
                        [entry.version]: {
                            name,
                            version: entry.version,
                            bin: entry.bin,
                            dist: { tarball: `${url.origin}/${name}.tgz`, integrity: entry.integrity },
                        },
                    },
                });
            },
        });
        try {
            const rootPackage = JSON.stringify({
                private: true,
                packageManager: `${manager}@${version.stdout.trim()}`,
                devDependencies: { eslint: '0.0.0-authored' },
                scripts: { test: 'authored-command' },
                workspaces: ['**'],
            });
            await createFileTree(repository.path, {
                [projectPath]: rootPackage,
                'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
                ...(projectPath === 'package.json' ? { 'pnpm-workspace.yaml': 'packages:\n  - "**"\n' } : {}),
                '.npmrc': `registry=http://127.0.0.1:${server.port}/\nalways-auth=true\n//127.0.0.1:${server.port}/:_authToken=${token}\n`,
                'gspot.toml': `version = 1\nlevel = "recommended"\nconfigurations = ["formatting"]\n${runner === 'none' ? '' : '[runner]\ntool = "mise"\n'}[rules]\ninstall = false\n`,
                'source.js': 'export const greeting="hello";',
                'node_modules/authored.txt': 'keep project dependencies',
            });
            const yarnConfiguration =
                manager === 'yarn' && Number(version.stdout.trim().split('.')[0]) >= 2
                    ? `npmRegistryServer: "http://127.0.0.1:${server.port}"\nnpmAuthToken: "${token}"\nnpmAlwaysAuth: true\nunsafeHttpWhitelist: ["127.0.0.1"]\n`
                    : undefined;
            if (yarnConfiguration !== undefined)
                writeFileSync(join(repository.path, '.yarnrc.yml'), yarnConfiguration, { mode: 0o600 });
            const initialized = await run(['git', 'init', '--quiet'], { cwd: repository.path });
            expect(initialized.code, initialized.stderr).toBe(0);
            const first = await applyAll(await openSession(repository.path));
            expect(first.notes.filter((note) => note.startsWith('preserved'))).toEqual([]);
            const manifest = readFileSync(join(repository.path, '.gspot/package.json'));
            const lockPath = join(repository.path, '.gspot', LOCKS[manager]);
            const lock = readFileSync(lockPath);
            const mode = statSync(lockPath).mode;
            const ownershipPath = join(repository.path, '.gspot/state/ownership.json');
            const ownership = readFileSync(ownershipPath);
            const preview = await run([process.execPath, CLI, 'install', '--dry-run', '--json'], {
                cwd: repository.path,
            });
            expect(preview.code, preview.stdout + preview.stderr).toBe(0);
            expect(JSON.parse(preview.stdout).isDryRun).toBe(true);
            expect(readFileSync(ownershipPath)).toEqual(ownership);
            expect(lock.toString('utf8')).not.toContain(token);
            if (manager === 'yarn' && version.stdout.trim().startsWith('1.'))
                expect(lock.toString('utf8')).not.toContain(`http://127.0.0.1:${server.port}`);
            const stale = lock.toString('utf8').replaceAll('3.8.1', '0.0.0');
            chmodSync(lockPath, 0o644);
            writeFileSync(lockPath, stale);
            const refused = await run([process.execPath, CLI, 'install', '--dry-run', '--json'], {
                cwd: repository.path,
            });
            expect(refused.code, refused.stdout + refused.stderr).toBe(2);
            expect(JSON.parse(refused.stdout).error).toContain('Run: gspot apply, then gspot install');
            await expect(installPackageProject(repository.path, tools)).rejects.toThrow(
                'Run: gspot apply, then gspot install',
            );
            expect(readFileSync(lockPath, 'utf8')).toBe(stale);
            expect(readFileSync(ownershipPath)).toEqual(ownership);
            expect(computeDrift(await openSession(repository.path))).toContainEqual({
                path: `.gspot/${LOCKS[manager]}`,
                kind: 'changed',
            });
            const conflict = `<<<<<<< edited
${stale}
=======
${lock.toString('utf8')}
>>>>>>> generated
`;
            writeFileSync(lockPath, conflict);
            writeFileSync(
                join(repository.path, projectPath),
                JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${manager}@99.0.0` }),
            );
            await expect(applyAll(await openSession(repository.path))).rejects.toThrow(
                'Install that package manager version first',
            );
            expect(readFileSync(lockPath, 'utf8')).toBe(conflict);
            expect(readFileSync(join(repository.path, '.gspot/package.json'))).toEqual(manifest);
            expect(readFileSync(ownershipPath)).toEqual(ownership);
            writeFileSync(join(repository.path, projectPath), rootPackage);
            const repaired = await applyAll(await openSession(repository.path));
            expect(repaired.written).toContain(`.gspot/${LOCKS[manager]}`);
            expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toEqual([]);
            const recovery = join(repository.path, '.gspot/state/recovery');
            expect(
                readdirSync(recovery, { recursive: true })
                    .filter((path) => String(path).endsWith('.original'))
                    .some((path) => readFileSync(join(recovery, String(path)), 'utf8') === conflict),
            ).toBe(true);
            const manifestPath = join(repository.path, '.gspot/package.json');
            chmodSync(manifestPath, 0o644);
            const withScript = JSON.stringify({
                ...JSON.parse(manifest.toString('utf8')),
                scripts: { postinstall: 'exit 42' },
            });
            writeFileSync(manifestPath, withScript);
            const requestsBefore = requests;
            await expect(installPackageProject(repository.path, tools)).rejects.toThrow('scripts');
            expect(requests).toBe(requestsBefore);
            expect(readFileSync(manifestPath, 'utf8')).toBe(withScript);
            writeFileSync(manifestPath, manifest);
            chmodSync(manifestPath, 0o444);
            if (manager === 'yarn') process.env['YARN_CACHE_FOLDER'] = join(artifacts.path, 'installation-cache');
            if (manager === 'yarn') process.env['YARN_GLOBAL_FOLDER'] = join(artifacts.path, 'installation-global');
            if (runner === 'none') {
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
                    await expect(installPackageProject(repository.path, tools)).rejects.toThrow(
                        'Native wrapper download failed',
                    );
                    expect(existsSync(join(repository.path, '.gspot/node_modules/prettier'))).toBe(false);
                    expect(readFileSync(lockPath)).toEqual(lock);
                } finally {
                    initialize.mockRestore();
                }
            }
            const beforeInstall = requests;
            let installed: string;
            if (runner === 'none') {
                const result = await run([process.execPath, CLI, 'install'], { cwd: repository.path });
                expect(result.code, result.stdout + result.stderr).toBe(0);
                installed = result.stdout;
            } else installed = await installPackageProject(repository.path, tools);
            if (manager === 'yarn') expect(requests).toBeGreaterThan(beforeInstall);
            if (runner === 'none') {
                const binary = readOwnership(repository.path).files.find(
                    (entry) =>
                        entry.path.startsWith('.gspot/node_modules/editorconfig-checker/bin/') &&
                        entry.path.endsWith('/editorconfig-checker'),
                );
                expect(binary?.installed).toBeDefined();
                const checker = configurationManifests()
                    .get('formatting')!
                    .tools.find((tool) => tool.name === 'ec')!;
                expect(probeTool({ root: repository.path, probes: new Map() }, checker).state).toBe('ok');
                expect(readOwnership(repository.path).files.find((entry) => entry.path === binary?.path)).toEqual(
                    binary,
                );
            }

            expect(installed).toContain('.gspot/node_modules');
            expect(requests).toBeGreaterThan(0);
            expect(readFileSync(join(repository.path, projectPath), 'utf8')).toBe(rootPackage);
            if (projectPath === 'package.json')
                expect(readFileSync(join(repository.path, 'pnpm-workspace.yaml'), 'utf8')).toBe(
                    'packages:\n  - "**"\n',
                );
            if (yarnConfiguration !== undefined)
                expect(readFileSync(join(repository.path, '.yarnrc.yml'), 'utf8')).toBe(yarnConfiguration);
            expect(readFileSync(join(repository.path, 'node_modules/authored.txt'), 'utf8')).toBe(
                'keep project dependencies',
            );
            expect(readFileSync(lockPath)).toEqual(lock);
            expect(statSync(lockPath).mode).toBe(mode);
            expect(readFileSync(join(repository.path, '.gspot/package.json'))).toEqual(manifest);
            const executable = join(repository.path, '.gspot/node_modules/.bin/prettier');
            const invalid = await run([executable, '--check', 'source.js'], { cwd: repository.path });
            expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
            const corrected = await run([executable, '--write', 'source.js'], { cwd: repository.path });
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const checked = await run([executable, '--check', 'source.js'], { cwd: repository.path });
            expect(checked.code, checked.stdout + checked.stderr).toBe(0);
            expect(computeDrift(await openSession(repository.path))).toEqual([]);
            const second = await applyAll(await openSession(repository.path));
            expect(second.written).toEqual([]);
            expect(readFileSync(lockPath)).toEqual(lock);
            const readmePath = join(repository.path, '.gspot/node_modules/prettier/README.md');
            const readme = readFileSync(readmePath);
            writeFileSync(readmePath, 'authored later');
            await expect(installPackageProject(repository.path, tools)).rejects.toThrow('Preserved edited');
            expect(readFileSync(join(repository.path, '.gspot/node_modules/prettier/README.md'), 'utf8')).toBe(
                'authored later',
            );
            const context = { root: repository.path, probes: new Map() };
            const pin = {
                name: 'prettier',
                version: '3.8.1',
                installers: { npm: { name: 'prettier', version: '3.8.1' } },
                windows: true,
            };
            expect(probeTool(context, pin)).toMatchObject({
                state: 'error',
                note: 'Tool installation is incomplete. Run: gspot install',
            });
            writeFileSync(readmePath, readme);
            await installPackageProject(repository.path, tools);
            expect(probeTool(context, pin).state).toBe('ok');
            if (projectPath === 'package.json' && runner === 'mise') {
                const clone = join(artifacts.path, 'clone');
                for (const argv of [
                    ['git', 'add', '--all'],
                    [
                        'git',
                        '-c',
                        'user.name=Fixture',
                        '-c',
                        'user.email=fixture@example.com',
                        '-c',
                        'commit.gpgsign=false',
                        'commit',
                        '--quiet',
                        '-m',
                        'Fixture',
                    ],
                    ['git', 'clone', '--quiet', '--no-local', repository.path, clone],
                ]) {
                    const result = await run(argv, { cwd: repository.path });
                    expect(result.code, result.stdout + result.stderr).toBe(0);
                }
                expect(existsSync(join(clone, '.gspot/node_modules'))).toBe(false);
                expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
                for (let attempt = 0; attempt < 2; attempt++) {
                    const installed = await installPackageProject(clone, tools);
                    expect(installed).toContain('.gspot/node_modules');
                    const status = await run(['git', 'status', '--porcelain'], { cwd: clone });
                    expect(status.code, status.stderr).toBe(0);
                    expect(status.stdout).toBe('');
                    expect(readFileSync(join(clone, '.gspot', LOCKS[manager]))).toEqual(lock);
                    expect(readFileSync(join(clone, '.gspot/package.json'))).toEqual(manifest);
                }
                const formatter = join(clone, '.gspot/node_modules/.bin/prettier');
                writeFileSync(join(clone, 'source.js'), 'export const greeting="hello";');
                const defect = await run([formatter, '--check', 'source.js'], { cwd: clone });
                expect(defect.code, defect.stdout + defect.stderr).toBe(1);
                const fixed = await run([formatter, '--write', 'source.js'], { cwd: clone });
                expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
                const clean = await run([formatter, '--check', 'source.js'], { cwd: clone });
                expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            }
        } finally {
            if (previousCache === undefined) delete process.env['YARN_CACHE_FOLDER'];
            else process.env['YARN_CACHE_FOLDER'] = previousCache;
            if (previousGlobal === undefined) delete process.env['YARN_GLOBAL_FOLDER'];
            else process.env['YARN_GLOBAL_FOLDER'] = previousGlobal;
            server.stop(true);
        }
    },
    120000,
);
