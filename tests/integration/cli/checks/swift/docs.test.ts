import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as inspections from '#cli/tools/inspect.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkSwiftlint } from '#cli/checks/swift/lint.ts';

test('Swift documentation adapter rejects malformed native output and removes its selected workspace', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const text = 'public let value = 1 /** Inline documentation. */\n';
    await createFileTree(root, {
        'gspot.toml': 'version = 1\nlevel = "all"\nkits = ["swift"]\n',
        'nested/Value.swift': text,
    });
    const configurationSession = await openSession(root);
    for (const file of emitAll(
        configurationSession.policyFiles.policy,
        configurationSession.repository,
        configurationSession.scopes,
        {
            version: configurationSession.version,
            packageClient: configurationSession.packageClient,
        },
    ).files.filter(({ path }) => path.endsWith('swiftlint.yml')))
        await Bun.write(join(root, file.path), file.content);
    const session = await openSession(root);
    const plans = planRun(session, { stage: 'all', only: ['swift/swiftlint'], skips: [] });
    const planned = plans[0]!;
    const inspection = spyOn(inspections, 'inspectTool').mockReturnValue({
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
        inspection.mockRestore();
    }
});
