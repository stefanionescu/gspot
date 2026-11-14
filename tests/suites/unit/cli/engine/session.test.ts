import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { compareText } from '#cli/system/text/order.ts';
import { listAlwaysSelected } from '#cli/manifests/select.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('all selects the always-selected configurations from an empty list', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
        'source.js': 'export const port = 8080;\n',
        'guide.md': '# Guide\n',
        'app/package.json': '{"name":"app","private":true}',
        'app/source.js': 'export const port = 3000;\n',
    });
    commitAll(sandbox.path);
    const session = await openSession(sandbox.path);
    const selected = new Set(
        session.scopes.flatMap((scope) => scope.configurations.map((configuration) => configuration.name)),
    );
    expect([...selected].toSorted(compareText)).toStrictEqual(listAlwaysSelected().toSorted(compareText));
});
