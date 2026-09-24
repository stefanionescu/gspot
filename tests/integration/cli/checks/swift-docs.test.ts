import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/run/session.ts';
import { planRun } from '#cli/run/plan.ts';
import { emitAll } from '#cli/emit/targets.ts';
import * as processes from '#cli/platform/spawn.ts';
import * as probes from '#cli/tools/tool-probe.ts';
import { checkSwiftlint } from '#cli/structure/swift/lint.ts';

test('Swift documentation adapter rejects malformed native output and removes its selected workspace', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const text = 'public let value = 1 /** Inline documentation. */\n';
    await createFileTree(root, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["swift"]\n',
        'nested/Value.swift': text,
    });
    for (const file of emitAll(await openSession(root)).files.filter(({ path }) => path.endsWith('swiftlint.yml')))
        await Bun.write(join(root, file.path), file.content);
    const session = await openSession(root);
    const planned = (await planRun(session, { stage: 'all', only: ['swift/swiftlint'], skips: [] }))[0]!;
    const probe = spyOn(probes, 'probeTool').mockReturnValue({
        name: 'swiftlint',
        state: 'ok',
        path: '/fixture/swiftlint',
        found: '0.63.2',
    });
    let workspace = '';
    const malformed = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command.includes('--reporter') && options.cwd !== root) {
            workspace = options.cwd;
            return Promise.resolve({ code: 0, missing: false, stdout: '{', stderr: '', duration: 1 });
        }
        return Promise.resolve({ code: 0, missing: false, stdout: '[]', stderr: '', duration: 1 });
    });
    try {
        const failed = await checkSwiftlint(session, planned);
        expect(failed.status).toBe('error');
        expect(failed.note).toContain('invalid JSON report');
        expect(workspace).not.toBe('');
        expect(existsSync(workspace)).toBe(false);
        expect(await Bun.file(join(root, 'nested/Value.swift')).text()).toBe(text);
    } finally {
        malformed.mockRestore();
        probe.mockRestore();
    }
});
