import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { ReplacePlan } from '#cli/types/commands.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { currentBlock } from '#cli/lifecycle/managed-blocks.ts';
import { statSync, chmodSync, existsSync, symlinkSync, readFileSync } from 'node:fs';

const INIT = ['init', '--yes', '--json', '--kits', 'bash', '--no-runner', '--no-hooks', '--no-ci', '--no-install'];

test('agent instructions reach AGENTS.md and configured files, and other agent files stay as written', async () => {
    await using sandbox = await testdir();
    const original = '# Gemini instructions\n\nKeep this authored note.\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([]),
        'GEMINI.md': original,
        '.github/copilot-instructions.md': '# Copilot instructions\n',
        '.cursor/.keep': '',
    });
    const gemini = join(sandbox.path, 'GEMINI.md');
    chmodSync(gemini, 0o600);
    const mode = statSync(gemini).mode;
    const selected = await run(sandbox.path, ['set', 'guides.agents', 'TEAM.md']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const applied = await run(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const instructions = currentBlock(readFileSync(join(sandbox.path, 'AGENTS.md'), 'utf8'), 'markdown');
    expect(instructions).toContain('general/agent/WORKING.md');
    expect(currentBlock(readFileSync(join(sandbox.path, 'TEAM.md'), 'utf8'), 'markdown')).toBe(instructions);
    expect(readFileSync(gemini, 'utf8')).toBe(original);
    expect(statSync(gemini).mode).toBe(mode);
    expect(readFileSync(join(sandbox.path, '.github/copilot-instructions.md'), 'utf8')).toBe(
        '# Copilot instructions\n',
    );
    for (const path of ['CLAUDE.md', '.cursor/rules/gspot.mdc'])
        expect(existsSync(join(sandbox.path, path)), path).toBe(false);
    const modified = statSync(join(sandbox.path, 'AGENTS.md')).mtimeMs;
    const again = await run(sandbox.path, ['apply']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(statSync(join(sandbox.path, 'AGENTS.md')).mtimeMs).toBe(modified);
});

test('an agent destination outside the repository is refused', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([]) });
    const before = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
    const refused = await run(sandbox.path, ['set', 'guides.agents', '../outside.md']);
    expect(refused.code).toBe(2);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(before);
});

test('init deletes CLAUDE.md and moves its text to the end of AGENTS.md', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'CLAUDE.md': '# Claude notes\n\nRun the tests.\n',
        'GEMINI.md': '# Keep this\n',
    });
    const preview = await run(sandbox.path, [...INIT, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { plan } = JSON.parse(preview.stdout) as { plan: ReplacePlan };
    expect(plan.write.map((entry) => entry.path)).toContain('AGENTS.md');
    expect(plan.write.map((entry) => entry.path)).not.toContain('GEMINI.md');
    expect(plan.remove).toContainEqual({ path: 'CLAUDE.md', note: 'its own text moves to the end of AGENTS.md' });
    expect(readFileSync(join(sandbox.path, 'CLAUDE.md'), 'utf8')).toBe('# Claude notes\n\nRun the tests.\n');
    const installed = await run(sandbox.path, INIT);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    const agents = readFileSync(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(currentBlock(agents, 'markdown')).toContain('WORKING.md');
    expect(agents).toEndWith('<<< -->\n\n## Other instructions\n\n# Claude notes\n\nRun the tests.\n');
    expect(readFileSync(join(sandbox.path, 'GEMINI.md'), 'utf8')).toBe('# Keep this\n');
});

test('init without the rules still deletes CLAUDE.md and keeps its text in AGENTS.md', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'CLAUDE.md': '# Claude notes\n' });
    const installed = await run(sandbox.path, [...INIT, '--no-guides']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    expect(readFileSync(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe('## Other instructions\n\n# Claude notes\n');
});

test('apply moves an installed CLAUDE.md once and drops the copy of the block', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([]), 'CLAUDE.md': '# Claude notes\n' });
    const first = await run(sandbox.path, ['apply']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    const moved = readFileSync(join(sandbox.path, 'AGENTS.md'), 'utf8');
    // A `CLAUDE.md` that holds the block and text `AGENTS.md` already has goes without a second copy.
    await createFileTree(sandbox.path, { 'CLAUDE.md': moved });
    const second = await run(sandbox.path, ['apply']);
    expect(second.code, second.stdout + second.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    expect(readFileSync(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(moved);
    expect(moved.match(/## Other instructions/gu)).toHaveLength(1);
});

if (onPosix)
    test('init deletes a CLAUDE.md link and moves nothing', async () => {
        await using sandbox = await testdir();
        symlinkSync('AGENTS.md', join(sandbox.path, 'CLAUDE.md'));
        const installed = await run(sandbox.path, INIT);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(existsSync(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'AGENTS.md'), 'utf8')).not.toContain('## Other instructions');
    });
