import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { licensesPackages } from '#cli/checks/licenses.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    for (const file of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.filter(({ path }) => path.endsWith('/licenses.json')))
        await Bun.write(join(root, file.path), file.content);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'licenses/packages')!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
}

test('native Python license scanning ignores project scanner exclusions and verifies exact reported exceptions', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'gspot.toml': 'version = 1\nconfigurations = ["licenses"]\n',
        'pyproject.toml':
            '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
    });
    for (const command of [
        ['uv', 'venv', '.venv'],
        ['uv', 'venv', '.gspot/.venv'],
        ['uv', 'pip', 'install', '--python', '.gspot/.venv/bin/python', 'pip-licenses==5.5.5'],
    ]) {
        const result = await run(command, { cwd: root, timeoutMs: 60_000 });
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const location = await run(
        [join(root, '.venv/bin/python'), '-I', '-c', 'import sysconfig; print(sysconfig.get_path("purelib"))'],
        { cwd: root },
    );
    expect(location.code, location.stderr).toBe(0);
    const metadata = join(location.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
    const writeLicense = async (license: string): Promise<void> => {
        await Bun.write(
            metadata,
            `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: ${license}\n`,
        );
    };
    await writeLicense('GPL-3.0-only');
    expect(await licensesPackages(await input(root))).toStrictEqual([
        containing({
            file: 'pyproject.toml',
            rule: 'license',
            message: textContaining('licensed-example@1.0.0 reports GPL-3.0-only'),
        }),
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        'version = 1\nconfigurations = ["licenses"]\n[[tools.licenses.packages_allowed]]\npackage = "Licensed._Example@1.0.0"\nlicense = "GPL-3.0-only"\nreason = "Fixture tests exact reported license consent."\n',
    );
    expect(await licensesPackages(await input(root))).toStrictEqual([]);
    await writeLicense('MIT');
    expect(await licensesPackages(await input(root))).toStrictEqual([
        containing({ rule: 'license', message: textContaining('exception no longer holds') }),
    ]);
    await Bun.write(join(root, 'gspot.toml'), 'version = 1\nconfigurations = ["licenses"]\n');
    expect(await licensesPackages(await input(root))).toStrictEqual([]);
    await writeLicense('MIT-0');
    expect(await licensesPackages(await input(root))).toStrictEqual([
        containing({ message: textContaining('reports MIT-0, which is not an allowed license') }),
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        'version = 1\nconfigurations = ["licenses"]\n[tools.licenses]\nlicenses_allowed = ["MIT-0"]\n',
    );
    expect(await licensesPackages(await input(root))).toStrictEqual([]);
});
