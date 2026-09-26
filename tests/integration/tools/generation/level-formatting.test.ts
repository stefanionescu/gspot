import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { executeRun } from '#cli/execution/execute.ts';

test.each(['recommended', 'all'] as const)('%s reports and fixes ordinary shell formatting', async (level) => {
    await using sandbox = await testdir();
    const source = "if true;then\nprintf '%s\\n' one\nfi\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["bash"]\n`,
        'example.sh': source,
    });
    const session = await openSession(sandbox.path);
    for (const file of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.filter((file) => file.kind === 'config'))
        await Bun.write(join(sandbox.path, file.path), file.content);
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['bash/shfmt'],
        fix: false,
        isDryRun: false,
        noCache: true,
    };
    const defect = await executeRun(session, options);
    expect(defect.report.exitCode, JSON.stringify(defect.report)).toBe(1);
    const correction = await executeRun(await openSession(sandbox.path), { ...options, fix: true });
    expect(correction.report.exitCode, JSON.stringify(correction.report)).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'example.sh')).text()).not.toBe(source);
    expect((await executeRun(await openSession(sandbox.path), options)).report.exitCode).toBe(0);
});
