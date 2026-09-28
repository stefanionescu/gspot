import { createFileTree } from 'testdirs';
import { delimiter, join } from 'node:path';
import { gitOutput } from '#tests/support/cli/git.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';

/** Creates authored executable hooks in the Git-resolved default, external, or linked-worktree location. */
export async function prepareDispatcher(sandbox: string, external: string, launcher: string, kind: string) {
    const policy = 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n';
    await createFileTree(sandbox, { 'gspot.toml': policy });
    for (const args of [
        ['init', '-q'],
        ['add', 'gspot.toml'],
        ['commit', '-qm', 'base'],
    ])
        gitOutput(sandbox, args);
    let root = sandbox;
    if (kind === 'external') {
        await createFileTree(external, { "author's hooks/.keep": '' });
        gitOutput(root, ['config', 'core.hooksPath', join(external, "author's hooks")]);
    }
    if (kind === 'worktree') {
        root = join(external, "linked author's tree");
        gitOutput(sandbox, ['worktree', 'add', '--detach', root, 'HEAD']);
    }
    const directory = hookLocation(root).absolute;
    const hook = join(directory, 'pre-push');
    const original = `#!/usr/bin/env bun\nawait Bun.write('original.json', JSON.stringify({args: process.argv.slice(2), input: await Bun.stdin.text(), cwd: process.cwd()}));\nprocess.exit(0);\n`;
    writeFileSync(hook, original, { mode: 0o751 });
    await createFileTree(launcher, {
        gspot: `#!/usr/bin/env bun\nawait Bun.write('gspot.json', JSON.stringify({args: process.argv.slice(2), input: await Bun.stdin.text(), cwd: process.cwd(), hook: process.env.GSPOT_HOOK}));\nprocess.exit(0);\n`,
    });
    chmodSync(join(launcher, 'gspot'), 0o755);
    const config = readFileSync(join(sandbox, '.git/config'));
    const before = readFileSync(hook);
    const env = { PATH: `${launcher}${delimiter}${environmentVariables()['PATH'] ?? ''}` };
    return { root, directory, hook, original, config, before, env };
}
