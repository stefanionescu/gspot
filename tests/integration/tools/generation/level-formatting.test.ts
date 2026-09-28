import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

test.each([
    ['sample.ts', 'export const value = ;\n', 'export const value = 1;\n'],
    ['sample.json', '{"value":}\n', '{ "value": 1 }\n'],
])('Prettier syntax coverage rejects malformed %s and accepts its correction', async (path, source, corrected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: source });
    const options = {
        cwd: sandbox.path,
        env: { ...environmentVariables(), PATH: toolsPath(['prettier']) },
    };
    const defect = Bun.spawnSync(['prettier', '--check', path], options);
    expect(defect.exitCode, defect.stderr.toString()).toBe(2);
    expect(defect.stderr.toString()).toContain('SyntaxError');
    await Bun.write(join(sandbox.path, path), corrected);
    const verified = Bun.spawnSync(['prettier', '--check', path], options);
    expect(verified.exitCode, verified.stdout.toString() + verified.stderr.toString()).toBe(0);
});

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
        packageClient: session.packageClient,
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
    const verified = await executeRun(await openSession(sandbox.path), options);
    expect(verified.report.exitCode, JSON.stringify(verified.report)).toBe(0);
});
