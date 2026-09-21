import { expect, test } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import {
    resolvePythonProject,
    installPythonProject,
    pythonInstallSteps,
    pythonLockDrift,
} from '#cli/lifecycle/python-project.ts';
import { miseTasks } from '#cli/emit/runner-tasks.ts';
import { everyManifest } from '#cli/presets/select.ts';
import { toolEnvironment } from '#cli/emit/tool-environment.ts';
import { openSession } from '#cli/run/session.ts';

test.each([
    ['uv.toml', 'uv'],
    ['pyproject.toml', 'uv'],
    ['pyproject.toml', 'mise'],
    ['pyproject.toml', 'none'],
] as const)(
    'uv reads %s with the %s runner, installs the pinned Python checker privately, preserves locked inputs, and repairs a conflicted lock before corrected-input success',
    async (configuration, runner) => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': `version = 1\nlevel = "recommended"\npresets = ["python"]\n${runner === 'none' ? '' : `[runner]\ntool = "${runner}"\n`}[rules]\ninstall = false\n`,
            'pyproject.toml':
                '[project]\nname = "authored"\nversion = "1.0.0"\ndependencies = ["authored-dependency"]\n',
            '.venv/authored.txt': 'keep the project environment',
            'source.py': 'import os\n',
        });
        const session = await openSession(repository.path);
        // This native installation journey selects one shipped Python executable.
        const selected = {
            ...session,
            scopes: session.scopes.map((scope) => ({
                ...scope,
                selected: scope.selected.map((manifest) => ({
                    ...manifest,
                    tools: manifest.tools.filter((tool) => tool.name === 'ruff'),
                })),
            })),
        };
        const proposals = toolEnvironment(selected);
        if (runner === 'mise') proposals.push(miseTasks(everyManifest(selected), selected.version, false));
        const binary = Bun.which('ruff');
        expect(binary).not.toBeNull();
        const version = await run([binary!, '--version'], { cwd: repository.path });
        expect(version.code).toBe(0);
        const pinned = version.stdout.trim().split(' ')[1]!;
        expect(proposals[0]!.content).toContain(`ruff==${pinned}`);
        const wheel = `ruff-${pinned}-py3-none-any.whl`;
        const packed = await run(
            [
                'python3',
                '-c',
                String.raw`import sys, zipfile, hashlib, base64, csv, io
binary, target, version = sys.argv[1:]
info = "ruff-" + version + ".dist-info"
entries = {
 "ruff-" + version + ".data/scripts/ruff": open(binary, "rb").read(),
 info + "/METADATA": ("Metadata-Version: 2.1\nName: ruff\nVersion: " + version + "\n").encode(),
 info + "/WHEEL": b"Wheel-Version: 1.0\nGenerator: gspot-acceptance\nRoot-Is-Purelib: false\nTag: py3-none-any\n"
}
record = io.StringIO(); writer = csv.writer(record)
for path, data in entries.items(): writer.writerow([path, "sha256=" + base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip("="), len(data)])
writer.writerow([info + "/RECORD", "", ""]); entries[info + "/RECORD"] = record.getvalue().encode()
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
 for path, data in entries.items():
  entry = zipfile.ZipInfo(path); entry.external_attr = (0o100755 if path.endswith("/ruff") else 0o100644) << 16; archive.writestr(entry, data)
`,
                binary!,
                join(artifacts.path, wheel),
                pinned,
            ],
            { cwd: artifacts.path },
        );
        expect(packed.code, packed.stderr).toBe(0);
        const archive = readFileSync(join(artifacts.path, wheel));
        const digest = createHash('sha256').update(archive).digest('hex');
        const server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch(request) {
                if (
                    request.headers.get('authorization') !==
                    `Basic ${Buffer.from('gspot:synthetic-uv-password').toString('base64')}`
                )
                    return new Response('Authentication required', { status: 401 });
                if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
                return new Response(`<a href="/${wheel}#sha256=${digest}">${wheel}</a>`, {
                    headers: { 'content-type': 'text/html' },
                });
            },
        });
        const previous = process.env['UV_DEFAULT_INDEX'];
        const redirected = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'];
        const previousProjects = redirected.map((name) => [name, process.env[name]] as const);
        for (const name of redirected)
            process.env[name] = name === 'UV_PROJECT_ENVIRONMENT' ? join(repository.path, '.venv') : repository.path;
        delete process.env['UV_DEFAULT_INDEX'];
        const index = `[[${configuration === 'pyproject.toml' ? 'tool.uv.' : ''}index]]\nname = "gspot-test"\nurl = "http://gspot:synthetic-uv-password@127.0.0.1:${server.port}/simple"\ndefault = true\n`;
        const authored =
            configuration === 'pyproject.toml' ? readFileSync(join(repository.path, configuration), 'utf8') : '';
        writeFileSync(join(repository.path, configuration), authored + index);
        const rootProject = readFileSync(join(repository.path, 'pyproject.toml'));
        const rootConfiguration = readFileSync(join(repository.path, configuration));
        try {
            await withLifecycleOwner(repository.path, async (owner) => {
                await resolvePythonProject(repository.path, proposals, owner);
                for (const file of proposals)
                    owner.replace(
                        file.path,
                        { bytes: Buffer.from(file.content), mode: 0o444 },
                        file.kind === 'lock' ? 'lock' : 'config',
                    );
            });
            expect(pythonInstallSteps(repository.path)).toEqual([['uv', 'sync', '--locked', '--project', '.gspot']]);
            const manifest = readFileSync(join(repository.path, '.gspot/pyproject.toml'));
            const lockPath = join(repository.path, '.gspot/uv.lock');
            const lock = readFileSync(lockPath);
            expect(lock.toString('utf8')).not.toContain('synthetic-uv-password');
            await createFileTree(artifacts.path, { 'bin/uv': '#!/bin/sh\nexit 87\n' });
            chmodSync(join(artifacts.path, 'bin/uv'), 0o755);
            const command = await run(
                [
                    process.execPath,
                    fileURLToPath(new URL('../../../src/main.ts', import.meta.url)),
                    'install',
                    '--json',
                ],
                {
                    cwd: repository.path,
                    env: {
                        ...(runner === 'mise'
                            ? { PATH: `${join(artifacts.path, 'bin')}:${process.env['PATH'] ?? ''}` }
                            : {}),
                        MISE_TRUSTED_CONFIG_PATHS: repository.path,
                        MISE_STATE_DIR: join(artifacts.path, 'mise-state'),
                        MISE_CACHE_DIR: join(artifacts.path, 'mise-cache'),
                        MISE_CONFIG_DIR: join(artifacts.path, 'mise-config'),
                    },
                },
            );
            expect(command.code, command.stdout + command.stderr).toBe(1);
            expect(JSON.parse(command.stdout).error).toContain('Run: gspot apply, then gspot install');
            expect(JSON.parse(command.stdout).error).toContain('installed locked Python tools');
            expect(readFileSync(join(repository.path, 'pyproject.toml'))).toEqual(rootProject);
            expect(readFileSync(join(repository.path, '.venv/authored.txt'), 'utf8')).toBe(
                'keep the project environment',
            );
            expect(readFileSync(join(repository.path, '.gspot/pyproject.toml'))).toEqual(manifest);
            expect(readFileSync(lockPath)).toEqual(lock);
            expect(readFileSync(join(repository.path, configuration))).toEqual(rootConfiguration);
            const installed = join(repository.path, '.gspot/.venv/bin/ruff');
            const invalid = await run([installed, 'check', '--output-format', 'json', 'source.py'], {
                cwd: repository.path,
            });
            expect(invalid.code, invalid.stderr).toBe(1);
            expect(JSON.parse(invalid.stdout).map((finding: { code: string }) => finding.code)).toEqual(['F401']);
            const corrected = await run([installed, 'check', '--fix', 'source.py'], { cwd: repository.path });
            expect(corrected.code, corrected.stderr).toBe(0);
            expect((await run([installed, 'check', 'source.py'], { cwd: repository.path })).code).toBe(0);
            chmodSync(lockPath, 0o644);
            writeFileSync(lockPath, '<<<<<<< interrupted lock\n');
            expect(() => pythonInstallSteps(repository.path)).toThrow('Run: gspot apply, then gspot install');
            await expect(installPythonProject(repository.path)).rejects.toThrow('Run: gspot apply, then gspot install');
            const repaired = toolEnvironment(selected);
            await withLifecycleOwner(repository.path, async (owner) => {
                await resolvePythonProject(repository.path, repaired, owner);
                for (const file of repaired)
                    owner.replace(
                        file.path,
                        { bytes: Buffer.from(file.content), mode: 0o444 },
                        file.kind === 'lock' ? 'lock' : 'config',
                        file.kind === 'lock',
                        file.observed,
                    );
            });
            expect(pythonLockDrift(repository.path, repaired)).toEqual({ path: '.gspot/uv.lock' });
            await installPythonProject(repository.path);
            expect(readFileSync(lockPath)).toEqual(lock);
            expect(readFileSync(join(repository.path, configuration))).toEqual(rootConfiguration);
            expect((await run([installed, 'check', 'source.py'], { cwd: repository.path })).code).toBe(0);
        } finally {
            if (previous === undefined) delete process.env['UV_DEFAULT_INDEX'];
            else process.env['UV_DEFAULT_INDEX'] = previous;
            for (const [name, value] of previousProjects) {
                if (value === undefined) delete process.env[name];
                else process.env[name] = value;
            }
            server.stop(true);
        }
    },
    120000,
);
