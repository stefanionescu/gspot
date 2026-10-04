import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { readTree } from '#tests/harness/preservation.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { rmSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';

test('apply removes and restores a stack while retaining its authored policy and custom checks', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], {
            tables: '[agent_rules]\nenabled = false\n[bash]\ndoc_style = "colon"\n[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\nreason = "The launcher intentionally expands its argument list."\n[[check]]\nname = "project/source"\npaths = ["*.sh"]\nstage = "commit"\ncommand = ["bash", "-n", "{files}"]\n',
        }),
        'source.sh': 'echo source\n',
    });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    unlinkSync(join(sandbox.path, 'source.sh'));
    const before = readTree(sandbox.path);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const planned = (preview.json as ApplyPreviewJson).policy;
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(readFileSync(path, 'utf8')).toBe(planned);
    const absent = parse(planned);
    expect(absent['configurations']).not.toContain('bash');
    expect(absent['bash']).toMatchObject({ doc_style: 'colon' });
    expect(absent['ignore']).toMatchObject([{ check: 'bash/shellcheck', rule: 'SC2086' }]);
    expect(absent['check']).toMatchObject([{ name: 'project/source' }]);
    expect(emitAll(await openSession(sandbox.path)).files.map((file) => file.path)).not.toContain(
        '.gspot/config/shellcheckrc',
    );
    writeFileSync(join(sandbox.path, 'source.sh'), 'echo restored\n');
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const restored = await openSession(sandbox.path);
    expect(restored.policyFiles.policy.configurations).toContain('bash');
    expect(emitAll(restored).files.find((file) => file.path === '.gspot/config/shellcheckrc')?.content).toContain(
        'SC2086',
    );
    const stable = readTree(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(readTree(sandbox.path)).toStrictEqual(stable);
});

test('absent scopes retain authored settings without planning their checks or tool configurations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: '[agent_rules]\nenabled = false\n[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\npaths = ["scripts/**"]\nreason = "The launcher intentionally expands its arguments."\n[[scope]]\npath = "scripts"\nconfigurations = ["bash"]\n[scope.bash]\ndoc_style = "colon"\n',
        }),
        'scripts/source.sh': 'echo source\n',
    });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    rmSync(join(sandbox.path, 'scripts'), { recursive: true });
    const before = readTree(sandbox.path);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(readTree(sandbox.path)).toStrictEqual(before);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe((preview.json as ApplyPreviewJson).policy);
    const absent = await openSession(sandbox.path);
    expect(absent.policyFiles.policy.scopes).toStrictEqual([{ path: 'scripts', configurations: ['bash'] }]);
    expect(absent.scopes.map((scope) => scope.scope.path)).toStrictEqual(['']);
    expect(parse(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8'))).toMatchObject({
        scope: [{ bash: { doc_style: 'colon' } }],
        ignore: [{ paths: ['scripts/**'], reason: 'The launcher intentionally expands its arguments.' }],
    });
    await createFileTree(sandbox.path, { 'scripts/source.sh': 'echo restored\n' });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const restored = await openSession(sandbox.path);
    expect(restored.scopes.find((scope) => scope.scope.path === 'scripts')?.view.settings['bash.doc_style']).toBe(
        'colon',
    );
    const stable = readTree(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(readTree(sandbox.path)).toStrictEqual(stable);
});
