import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { chmodSync, readFileSync } from 'node:fs';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import { VERSIONS } from '#tests/config/integration/tools/hooks.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PrepareHookAdoptionResult } from '#tests/types/results.ts';

const NATIVE_INSTALL = {
    'pre-commit': [
        '.venv/bin/pre-commit',
        'install',
        '--hook-type',
        'pre-commit',
        '--hook-type',
        'pre-push',
        '--hook-type',
        'commit-msg',
    ],
    lefthook: ['node_modules/.bin/lefthook', 'install'],
    husky: ['node_modules/.bin/husky'],
    'simple-git-hooks': ['node_modules/.bin/simple-git-hooks'],
} as const;

/** Prepares existing native launchers before gspot takes ownership of hook dispatch. */
export async function prepareHookAdoption(
    root: string,
    hookTool: keyof typeof VERSIONS,
): Promise<PrepareHookAdoptionResult> {
    await createFileTree(root, {
        'gspot.toml': `version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "${hookTool}"\n`,
        'package.json': JSON.stringify({
            private: true,
            devDependencies: hookTool === 'pre-commit' ? {} : { [hookTool]: VERSIONS[hookTool] },
        }),
        'source.txt': 'fixture\n',
        'bin/gspot': `#!${process.execPath}\n(await import('node:fs')).appendFileSync('observed', 'x');\n`,
        'native-init.sh': 'true\n',
    });
    chmodSync(join(root, 'bin/gspot'), 0o755);
    const options = {
        cwd: root,
        timeoutMs: 60_000,
        env: {
            PATH: `${join(root, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            XDG_CONFIG_HOME: join(root, 'fixture-config'),
            PRE_COMMIT_HOME: join(root, 'pre-commit-cache'),
        },
    };
    for (const command of [
        ['git', 'init', '-q'],
        ['git', 'add', 'source.txt'],
        ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture'],
        ...(hookTool === 'pre-commit'
            ? [
                  ['uv', 'venv', '.venv'],
                  ['uv', 'pip', 'install', '--python', '.venv/bin/python', `pre-commit==${VERSIONS[hookTool]}`],
              ]
            : [['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund']]),
    ]) {
        const result = await run(command, options);
        if (result.code !== 0) throw new Error(`Hook adoption fixture failed: ${result.stdout}${result.stderr}`);
    }
    const applied = await applyCommand({ cwd: root, isDryRun: false });
    if (applied.exitCode !== 0) throw new Error('Hook adoption fixture apply failed.');
    const [binary, ...args] = NATIVE_INSTALL[hookTool];
    const prepare = [join(root, binary), ...args];
    const prepared = await run(prepare, options);
    if (prepared.code !== 0) throw new Error(`Native hook preparation failed: ${prepared.stdout}${prepared.stderr}`);
    const location = hookLocation(root);
    const names = ['pre-commit', 'pre-push', 'commit-msg'];
    const original = names.map((name) => readFileSync(join(location.absolute, name)));
    return { options, prepare, location, names, original };
}
