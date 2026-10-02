import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { emitted } from '#tests/harness/cli/generated.ts';
import { venvExecutable } from '#tests/harness/cli/platforms.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

async function input(root: string): Promise<EngineInput> {
    const session = await openSession(root);
    for (const file of emitted(session).files.filter(({ path }) => path.endsWith('/licenses.json')))
        await Bun.write(join(root, file.path), file.content);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'licenses/packages')!;
    return scopeInput(session, spec);
}

test('native Python license scanning ignores project scanner exclusions and matches an exception by its normalized name', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'gspot.toml': policyOf(['licenses'], '', 'all'),
        'pyproject.toml':
            '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
    });
    for (const command of [
        ['uv', 'venv', '.venv'],
        ['uv', 'venv', '.gspot/.venv'],
        ['uv', 'pip', 'install', '--python', venvExecutable('.gspot/.venv', 'python'), 'pip-licenses==5.5.5'],
    ]) {
        const result = await run(command, { cwd: root, timeoutMs: 60_000 });
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const location = await run(
        [
            venvExecutable(join(root, '.venv'), 'python'),
            '-I',
            '-c',
            'import sysconfig; print(sysconfig.get_path("purelib"))',
        ],
        { cwd: root },
    );
    expect(location.code, location.stderr).toBe(0);
    const metadata = join(location.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
    await Bun.write(metadata, `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: GPL-3.0-only\n`);
    expect(await licensesPackages(await input(root))).toStrictEqual([
        containing({
            file: 'pyproject.toml',
            rule: 'disallowed-license',
            message: textContaining('licensed-example@1.0.0 reports GPL-3.0-only'),
        }),
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        policyOf(
            ['licenses'],
            '[[tools.licenses.exceptions]]\npackage = "Licensed._Example@1.0.0"\nlicense = "GPL-3.0-only"\nreason = "Fixture tests exact reported license consent."\n',
            'all',
        ),
    );
    expect(await licensesPackages(await input(root))).toStrictEqual([]);
});
