import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { gitOutput } from '#tests/support/cli/git.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import { plantLauncher } from '#tests/support/cli/platforms.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PrepareLefthookResult } from '#tests/types/results.ts';
import { LEFTHOOK_PUSH_ARGS } from '#tests/config/integration/tools/hooks.ts';

/** Prepares authored Lefthook configuration and existing Git hooks for native installation. */
export async function prepareLefthook(root: string, existing: string): Promise<PrepareLefthookResult> {
    await createFileTree(root, {
        'scratch/.keep': '',
        'gspot.toml': 'version = 1\nkits = []\n[guides]\ninstall = false\n[hooks]\ntool = "lefthook"\n',
        'package.json': '{"private":true,"devDependencies":{"lefthook":"2.0.13"}}\n',
        'hook-settings.yml': 'rc: ./hook-init.sh\n',
        'hook-init.sh': 'export GSPOT_FIXTURE_RC=retained\nprintf "%s" "$GSPOT_FIXTURE_RC" > rc-ran\n',
        'lefthook.yml':
            '# Authored hook\nextends: [hook-settings.yml]\npre-push:\n  commands:\n    authored:\n      run: echo retained\n',
    });
    await plantLauncher(
        root,
        'bin/gspot',
        `(await import('node:fs')).appendFileSync('gspot-runs', 'x'); await Bun.write('captured.json', JSON.stringify({args:process.argv.slice(2), input:process.argv.includes('--push') ? await Bun.stdin.text() : ''})); process.exitCode = await Bun.file('setup-failed').exists() ? 2 : await Bun.file('failed').exists() ? 1 : 0;\n`,
    );
    const installed = await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: root,
        timeoutMs: 60_000,
    });
    if (installed.code !== 0) throw new Error(`Lefthook fixture installation failed: ${installed.stderr}`);
    writeFileSync(join(root, 'source.txt'), 'fixture\n');
    for (const args of [
        ['init', '--quiet'],
        ['add', 'source.txt'],
        ['commit', '-qm', 'fixture'],
    ])
        gitOutput(root, args);

    const applied = await applyCommand({ cwd: root, isDryRun: false });
    if (applied.exitCode !== 0) throw new Error('Lefthook fixture apply failed.');
    const configuration = readFileSync(join(root, 'lefthook.yml'), 'utf8');
    const command = [join(root, 'node_modules/.bin/lefthook'), ...LEFTHOOK_PUSH_ARGS];
    const input = 'refs/heads/main a refs/heads/main b\nrefs/heads/other c refs/heads/other d\n';
    const options = {
        cwd: root,
        stdin: input,
        timeoutMs: 5000,
        env: {
            TMPDIR: join(root, 'scratch'),
            PATH: `${join(root, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            GSPOT_HOOK_REMOTE_NAME: 'origin',
            GSPOT_HOOK_REMOTE_LOCATION: 'remote',
        },
    };
    const location = hookLocation(root);
    if (existing === 'native') {
        const prepared = await run([join(root, 'node_modules/.bin/lefthook'), 'install'], options);
        if (prepared.code !== 0) throw new Error(`Lefthook fixture native setup failed: ${prepared.stderr}`);
    } else {
        writeFileSync(join(location.absolute, 'pre-commit'), '#!/bin/sh\nprintf retained > original-ran\n', {
            mode: 0o755,
        });
        writeFileSync(join(location.absolute, 'prepare-commit-msg'), '#!/bin/sh\nprintf retained > helper-ran\n', {
            mode: 0o755,
        });
    }
    const original = readFileSync(join(location.absolute, 'pre-commit'), 'utf8');
    const scriptPath = join(location.absolute, 'prepare-commit-msg');
    const originalScript = existsSync(scriptPath) ? readFileSync(scriptPath) : undefined;
    return { configuration, command, input, options, location, original, scriptPath, originalScript };
}
