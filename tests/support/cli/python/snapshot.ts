import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { run } from '#cli/platform/spawn.ts';
import { gitOutput } from '#tests/support/cli/git.ts';
import { venvExecutable } from '#tests/support/cli/platforms.ts';
import type { PrepareEditableSnapshotResult } from '#tests/types/results.ts';

const HATCHLING_BUILD =
    '[build-system]\nrequires = ["hatchling==1.27.0"]\nbuild-backend = "hatchling.build"\n[tool.hatch.build.targets.wheel]\npackages = ["src/editable_fixture"]\n';
const EDITABLE_BACKENDS = {
    hatchling: { packageDirectory: 'src/editable_fixture', build: HATCHLING_BUILD, dependencies: '' },
    'hatchling-exact': {
        packageDirectory: 'src/editable_fixture',
        build: HATCHLING_BUILD + 'dev-mode-exact = true\n',
        dependencies: '\n[dependency-groups]\ndev = ["editables==0.5"]\n',
    },
    setuptools: {
        packageDirectory: 'libsrc/differently_named',
        build: '[build-system]\nrequires = ["setuptools==80.9.0"]\nbuild-backend = "setuptools.build_meta"\n[tool.setuptools]\npackages = ["editable_fixture", "namespace_fixture.child"]\n[tool.setuptools.package-dir]\neditable_fixture = "libsrc/differently_named"\n"namespace_fixture.child" = "libsrc/namespace_child"\n',
        dependencies: '',
    },
};

/** Installs the pinned native package and records an index or committed source revision. */
export async function preparePythonSnapshot(
    root: string,
    kind: 'index' | 'commit',
): Promise<{ source: { kind: 'index'; hash?: never } | { kind: 'commit'; hash: string }; python: string }> {
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'pyproject.toml':
            '[project]\nname = "snapshot-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.11"\ndependencies = ["pre-commit==4.5.1"]\n',
    });
    for (const command of [
        ['uv', 'lock'],
        ['uv', 'sync', '--frozen', '--no-install-project'],
    ]) {
        const result = await run(command, { cwd: root, timeoutMs: 60_000 });
        if (result.code !== 0)
            throw new Error(`Python snapshot fixture installation failed: ${result.stdout}${result.stderr}`);
    }
    gitOutput(root, ['init', '-q']);
    gitOutput(root, ['add', '.']);
    gitOutput(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture']);
    const source = kind === 'index' ? { kind } : { kind, hash: gitOutput(root, ['rev-parse', 'HEAD']) };
    const python = venvExecutable(join(root, '.venv'), 'python');
    return { source, python };
}

/** Installs editable loaders, records selected source, and plants conflicting working-tree modules and bytecode. */
export async function prepareEditableSnapshot(
    root: string,
    kind: 'index' | 'commit',
    backend: keyof typeof EDITABLE_BACKENDS,
): Promise<PrepareEditableSnapshotResult> {
    const { packageDirectory, build, dependencies } = EDITABLE_BACKENDS[backend];
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'pyproject.toml':
            '[project]\nname = "editable-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.11"\n[project.scripts]\nfixture-entry = "editable_fixture:main"\n' +
            build +
            dependencies,
        [`${packageDirectory}/__init__.py`]: 'def main():\n    print("selected source")\n',
        'libsrc/namespace_child/__init__.py': 'def main():\n    print("selected namespace")\n',
    });
    for (const command of [
        ['uv', 'lock'],
        ['uv', 'sync', '--frozen'],
    ]) {
        const result = await run(command, { cwd: root, timeoutMs: 60_000 });
        if (result.code !== 0)
            throw new Error(`Editable snapshot fixture installation failed: ${result.stdout}${result.stderr}`);
    }
    gitOutput(root, ['init', '-q']);
    gitOutput(root, ['add', '.']);
    gitOutput(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture']);
    const source = kind === 'index' ? { kind } : { kind, hash: gitOutput(root, ['rev-parse', 'HEAD']) };
    const working = 'def main():\n    print("working source")\n';
    writeFileSync(join(root, packageDirectory, '__init__.py'), working);
    writeFileSync(join(root, 'libsrc/namespace_child/__init__.py'), 'def main():\n    print("working namespace")\n');
    // Hatchling maps modules itself; the other backends read compiled files, so the working tree gets some.
    if (backend !== 'hatchling') {
        const compiled = await run(
            [
                venvExecutable(join(root, '.venv'), 'python'),
                '-I',
                '-S',
                '-c',
                'import glob, py_compile; [py_compile.compile(path, invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH) for pattern in ("lib/python*", "Lib") for path in glob.glob(f".venv/{pattern}/site-packages/*_finder.py") + glob.glob(f".venv/{pattern}/site-packages/_editable_impl_*.py")]',
            ],
            { cwd: root },
        );
        if (compiled.code !== 0) throw new Error(`Editable bytecode fixture failed: ${compiled.stderr}`);
    }
    const python = venvExecutable(join(root, '.venv'), 'python');
    const sites = await run([python, '-I', '-c', 'import site; print(site.getsitepackages()[0])'], { cwd: root });
    if (sites.code !== 0) throw new Error(`Editable site-directory lookup failed: ${sites.stderr}`);
    return { source, packageDirectory, working, python, siteDirectory: sites.stdout.trim() };
}
