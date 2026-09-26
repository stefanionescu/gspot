import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { rejection } from '#tests/support/rejection.ts';
import { miseTasks } from '#cli/generation/runner-tasks.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { gitignoreBlock } from '#cli/generation/managed-blocks.ts';
import { toolEnvironment } from '#cli/generation/tool-environment.ts';
import { environmentVariables, setEnvironmentVariable } from '#cli/platform/environment.ts';
import { readFileSync, writeFileSync, chmodSync, cpSync, realpathSync, existsSync } from 'node:fs';

import {
    resolvePythonProject,
    installPythonProject,
    pythonInstallSteps,
    pythonLockDrift,
} from '#cli/tools/python-project.ts';

// A fresh clone installs the locked Python tools twice without tracked changes and runs the checker.
async function expectFreshCloneInstalls(
    repositoryPath: string,
    artifactsPath: string,
    recorded: {
        manifest: Buffer<ArrayBuffer>;
        lock: Buffer<ArrayBuffer>;
        configuration: string;
        rootConfiguration: Buffer<ArrayBuffer>;
    },
): Promise<void> {
    const clone = join(artifactsPath, 'clone');
    for (const argv of [
        ['git', 'init', '--quiet'],
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
        ['git', 'clone', '--quiet', '--no-local', repositoryPath, clone],
    ]) {
        const result = await run(argv, { cwd: repositoryPath });
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    expect(existsSync(join(clone, '.gspot/.venv'))).toBe(false);
    expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
    for (let attempt = 0; attempt < 2; attempt++) {
        expect(await installPythonProject(clone)).toContain('installed locked Python tools');
        const status = await run(['git', 'status', '--porcelain'], { cwd: clone });
        expect(status.code, status.stderr).toBe(0);
        expect(status.stdout).toBe('');
        expect(readFileSync(join(clone, '.gspot/pyproject.toml'))).toStrictEqual(recorded.manifest);
        expect(readFileSync(join(clone, '.gspot/uv.lock'))).toStrictEqual(recorded.lock);
        expect(readFileSync(join(clone, recorded.configuration))).toStrictEqual(recorded.rootConfiguration);
    }
    const checker = join(clone, '.gspot/.venv/bin/ruff');
    writeFileSync(join(clone, 'source.py'), 'import os\n');
    const defect = await run([checker, 'check', '--output-format', 'json', 'source.py'], { cwd: clone });
    expect(defect.code, defect.stderr).toBe(1);
    expect(JSON.parse(defect.stdout).map((finding: { code: string }) => finding.code)).toStrictEqual(['F401']);
    const fixed = await run([checker, 'check', '--fix', 'source.py'], { cwd: clone });
    expect(fixed.code, fixed.stderr).toBe(0);
    const clean = await run([checker, 'check', 'source.py'], { cwd: clone });
    expect(clean.code, clean.stderr).toBe(0);
    const prefix = await run([join(clone, '.gspot/.venv/bin/gspot-relocation-probe')], { cwd: clone });
    expect(prefix.code, prefix.stderr).toBe(0);
    expect(realpathSync(prefix.stdout.trim())).toBe(realpathSync(join(clone, '.gspot/.venv')));
}

test.each([
    ['uv.toml', 'none'],
    ['pyproject.toml', 'mise'],
    ['pyproject.toml', 'none'],
] as const)(
    'uv reads %s with the %s runner, installs the pinned Python checker privately, preserves locked inputs, and repairs a conflicted lock before corrected-input success',
    async (configuration, runner) => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await createFileTree(repository.path, {
            '.gitignore': `${gitignoreBlock()}\n.venv/\n`,
            'gspot.toml': `version = 1\nlevel = "recommended"\nconfigurations = ["python"]\n${runner === 'none' ? '' : `[runner]\ntool = "${runner}"\n`}[rules]\ninstall = false\n`,
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
        const proposals = toolEnvironment(everyManifest(selected.scopes));
        if (runner === 'mise') proposals.push(miseTasks(everyManifest(selected.scopes), selected.version, false));
        const binary = Bun.which('ruff');
        expect(binary).not.toBeNull();
        const version = await run([binary!, '--version'], { cwd: repository.path });
        expect(version.code).toBe(0);
        const pinned = version.stdout.trim().split(' ', 2)[1]!;
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
 "gspot_probe.py": b"def main():\n import sys\n print(sys.prefix)\n",
 info + "/entry_points.txt": b"[console_scripts]\ngspot-relocation-probe = gspot_probe:main\n",
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
        const previous = environmentVariables()['UV_DEFAULT_INDEX'];
        const redirected = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'];
        const previousProjects = redirected.map((name) => [name, environmentVariables()[name]] as const);
        try {
            for (const name of redirected)
                setEnvironmentVariable(
                    name,
                    name === 'UV_PROJECT_ENVIRONMENT' ? join(repository.path, '.venv') : repository.path,
                );
            setEnvironmentVariable('UV_DEFAULT_INDEX', undefined);
            const index = `[[${configuration === 'pyproject.toml' ? 'tool.uv.' : ''}index]]\nname = "gspot-test"\nurl = "http://gspot:synthetic-uv-password@127.0.0.1:${server.port}/simple"\ndefault = true\n`;
            const authored =
                configuration === 'pyproject.toml' ? readFileSync(join(repository.path, configuration), 'utf8') : '';
            writeFileSync(join(repository.path, configuration), authored + index);
            const rootProject = readFileSync(join(repository.path, 'pyproject.toml'));
            const rootConfiguration = readFileSync(join(repository.path, configuration));
            await withLifecycleOwner(repository.path, async (owner) => {
                await resolvePythonProject(repository.path, proposals, owner);
                for (const file of proposals)
                    owner.replace(
                        file.path,
                        { bytes: Buffer.from(file.content), mode: 0o444 },
                        file.kind === 'lock' ? 'lock' : 'config',
                    );
            });
            expect(pythonInstallSteps(repository.path)).toStrictEqual([
                ['uv', 'sync', '--locked', '--project', '.gspot'],
            ]);
            const manifest = readFileSync(join(repository.path, '.gspot/pyproject.toml'));
            const lockPath = join(repository.path, '.gspot/uv.lock');
            const lock = readFileSync(lockPath);
            expect(lock.toString('utf8')).not.toContain('synthetic-uv-password');
            await createFileTree(artifacts.path, { 'bin/uv': '#!/bin/sh\nexit 87\n' });
            chmodSync(join(artifacts.path, 'bin/uv'), 0o755);
            const command = await run(
                [
                    process.execPath,
                    fileURLToPath(new URL('../../../../packages/cli/src/main.ts', import.meta.url)),
                    'install',
                    '--json',
                ],
                {
                    cwd: repository.path,
                    env: {
                        ...(runner === 'mise'
                            ? { PATH: `${join(artifacts.path, 'bin')}:${environmentVariables()['PATH'] ?? ''}` }
                            : {}),
                        MISE_TRUSTED_CONFIG_PATHS: repository.path,
                        MISE_STATE_DIR: join(artifacts.path, 'mise-state'),
                        MISE_CACHE_DIR: join(artifacts.path, 'mise-cache'),
                        MISE_CONFIG_DIR: join(artifacts.path, 'mise-config'),
                    },
                },
            );
            expect(command.code, command.stdout + command.stderr).toBe(2);
            expect(JSON.parse(command.stdout).error).toContain('Run: gspot apply, then gspot install');
            expect(JSON.parse(command.stdout).error).toContain('installed locked Python tools');
            expect(readFileSync(join(repository.path, 'pyproject.toml'))).toStrictEqual(rootProject);
            expect(readFileSync(join(repository.path, '.venv/authored.txt'), 'utf8')).toBe(
                'keep the project environment',
            );
            expect(readFileSync(join(repository.path, '.gspot/pyproject.toml'))).toStrictEqual(manifest);
            expect(readFileSync(lockPath)).toStrictEqual(lock);
            expect(readFileSync(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
            const installed = join(repository.path, '.gspot/.venv/bin/ruff');
            const copiedEnvironment = join(artifacts.path, 'relocated environment');
            cpSync(join(repository.path, '.gspot/.venv'), copiedEnvironment, {
                recursive: true,
                verbatimSymlinks: true,
            });
            const relocated = await run([join(copiedEnvironment, 'bin/gspot-relocation-probe')], {
                cwd: artifacts.path,
            });
            expect(relocated.code, relocated.stderr).toBe(0);
            expect(realpathSync(relocated.stdout.trim())).toBe(realpathSync(copiedEnvironment));
            const invalid = await run([installed, 'check', '--output-format', 'json', 'source.py'], {
                cwd: repository.path,
            });
            expect(invalid.code, invalid.stderr).toBe(1);
            expect(JSON.parse(invalid.stdout).map((finding: { code: string }) => finding.code)).toStrictEqual(['F401']);
            const corrected = await run([installed, 'check', '--fix', 'source.py'], { cwd: repository.path });
            expect(corrected.code, corrected.stderr).toBe(0);
            expect((await run([installed, 'check', 'source.py'], { cwd: repository.path })).code).toBe(0);
            if (runner === 'none')
                await expectFreshCloneInstalls(repository.path, artifacts.path, {
                    manifest,
                    lock,
                    configuration,
                    rootConfiguration,
                });
            chmodSync(lockPath, 0o644);
            writeFileSync(lockPath, '<<<<<<< interrupted lock\n');
            expect(() => pythonInstallSteps(repository.path)).toThrow('Run: gspot apply, then gspot install');
            expect((await rejection(installPythonProject(repository.path))).message).toContain(
                'Run: gspot apply, then gspot install',
            );
            const repaired = toolEnvironment(everyManifest(selected.scopes));
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
            expect(pythonLockDrift(repository.path, repaired)).toStrictEqual({ path: '.gspot/uv.lock' });
            await installPythonProject(repository.path);
            expect(readFileSync(lockPath)).toStrictEqual(lock);
            expect(readFileSync(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
            expect((await run([installed, 'check', 'source.py'], { cwd: repository.path })).code).toBe(0);
        } finally {
            setEnvironmentVariable('UV_DEFAULT_INDEX', previous);
            for (const [name, value] of previousProjects) {
                setEnvironmentVariable(name, value);
            }
            await server.stop(true);
        }
    },
    120_000,
);
