import { currentBlock } from '#cli/emit/managed-blocks.ts';
import type { TakeoverPlan } from '#cli/types/ownership.ts';
import { run } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('agent instructions reach detected and configured consumers and uninstall restores authored content', async () => {
    await using sandbox = await testdir();
    const original = '# Gemini instructions\n\nKeep this authored note.\n';
    const copilot = '# Copilot instructions\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'GEMINI.md': original,
        '.github/copilot-instructions.md': copilot,
        '.cursor/.keep': '',
    });
    const gemini = join(sandbox.path, 'GEMINI.md');
    chmodSync(gemini, 0o600);
    const mode = statSync(gemini).mode;
    const selected = await run(sandbox.path, ['set', 'rules.agents', 'TEAM.md']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const applied = await run(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const content = readFileSync(join(sandbox.path, 'AGENTS.md'), 'utf8');
    const instructions = currentBlock(content, 'markdown');
    expect(instructions).toContain('general/agent/WORKING.md');
    for (const path of ['GEMINI.md', '.github/copilot-instructions.md', '.cursor/rules/gspot.mdc', 'TEAM.md']) {
        expect(currentBlock(readFileSync(join(sandbox.path, path), 'utf8'), 'markdown')).toBe(instructions);
    }
    expect(readFileSync(gemini, 'utf8')).toStartWith(original);
    expect(statSync(gemini).mode).toBe(mode);
    expect(readFileSync(join(sandbox.path, '.cursor/rules/gspot.mdc'), 'utf8')).toStartWith(
        '---\ndescription: Repository engineering rules\nalwaysApply: true\n---\n',
    );
    expect(existsSync(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    const modified = statSync(join(sandbox.path, 'AGENTS.md')).mtimeMs;
    const again = await run(sandbox.path, ['apply']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(statSync(join(sandbox.path, 'AGENTS.md')).mtimeMs).toBe(modified);
    const removed = await run(sandbox.path, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readFileSync(gemini, 'utf8')).toBe(original);
    expect(statSync(gemini).mode).toBe(mode);
    expect(readFileSync(join(sandbox.path, '.github/copilot-instructions.md'), 'utf8')).toBe(copilot);
    for (const path of ['AGENTS.md', 'TEAM.md', '.cursor/rules/gspot.mdc'])
        expect(existsSync(join(sandbox.path, path))).toBe(false);
    expect(existsSync(join(sandbox.path, '.cursor/.keep'))).toBe(true);
});

test('an authored Cursor rule is preserved and escaping agent destinations are refused', async () => {
    await using sandbox = await testdir();
    const original = '---\nalwaysApply: false\n---\n# Authored Cursor policy\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        '.cursor/rules/gspot.mdc': original,
    });
    const applied = await run(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(readFileSync(join(sandbox.path, '.cursor/rules/gspot.mdc'), 'utf8')).toBe(original);
    expect(applied.stdout + applied.stderr).toContain('.cursor/rules/gspot.mdc');
    const before = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
    const refused = await run(sandbox.path, ['set', 'rules.agents', '../outside.md']);
    expect(refused.code).toBe(2);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(before);
});

test('init previews the same detected agent destinations without writing them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'GEMINI.md': '# Keep this\n', '.cursor/.keep': '' });
    const preview = await run(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--json',
        '--configurations',
        'bash',
        '--without',
        'spelling',
        '--no-runner',
        '--no-hooks',
        '--no-ci',
        '--no-install',
    ]);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const proposal = JSON.parse(preview.stdout) as { plan: TakeoverPlan };
    const paths = proposal.plan.write.map((entry) => entry.path);
    expect(proposal.plan.change.map((entry) => entry.path)).toContain('.gitattributes');
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('GEMINI.md');
    expect(paths).toContain('.cursor/rules/gspot.mdc');
    expect(paths).not.toContain('CLAUDE.md');
    expect(existsSync(join(sandbox.path, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.cursor/rules/gspot.mdc'))).toBe(false);
    expect(readFileSync(join(sandbox.path, 'GEMINI.md'), 'utf8')).toBe('# Keep this\n');
});
