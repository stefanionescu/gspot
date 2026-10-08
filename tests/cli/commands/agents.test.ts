import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { INIT } from '#tests/config/cli/commands/agents.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { currentBlock } from '#cli/platform/managed-blocks.ts';
import { rm, stat, chmod, symlink, readFile } from 'node:fs/promises';

test('agent instructions reach AGENTS.md and configured files, and other agent files stay as written', async () => {
    await using sandbox = await testdir();
    const original = '# Gemini instructions\n\nKeep this authored note.\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([]),
        'GEMINI.md': original,
        '.github/copilot-instructions.md': '# Copilot instructions\n',
        '.cursor/.keep': '',
    });
    const gemini = join(sandbox.path, 'GEMINI.md');
    await chmod(gemini, 0o600);
    const { mode } = await stat(gemini);
    const selected = await runGspot(sandbox.path, ['set', 'agent_rules.instruction_files', 'TEAM.md']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const instructions = currentBlock(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8'), {
        path: 'AGENTS.md',
        style: 'markdown',
    });
    expect(instructions).toContain('agent/WORKING.md');
    expect(
        currentBlock(await readFile(join(sandbox.path, 'TEAM.md'), 'utf8'), { path: 'TEAM.md', style: 'markdown' }),
    ).toBe(instructions);
    expect(await readFile(gemini, 'utf8')).toBe(original);
    const currentGemini = await stat(gemini);
    expect(currentGemini.mode).toBe(mode);
    expect(await readFile(join(sandbox.path, '.github/copilot-instructions.md'), 'utf8')).toBe(
        '# Copilot instructions\n',
    );
    for (const path of ['CLAUDE.md', '.cursor/rules/gspot.mdc'])
        expect(await pathExists(join(sandbox.path, path)), path).toBe(false);
    const attributes = await stat(join(sandbox.path, 'AGENTS.md'));
    const modified = attributes.mtimeMs;
    const again = await runGspot(sandbox.path, ['apply']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    const current = await stat(join(sandbox.path, 'AGENTS.md'));
    expect(current.mtimeMs).toBe(modified);
});

test('an agent destination outside the repository is refused', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([]) });
    const before = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    const refused = await runGspot(sandbox.path, ['set', 'agent_rules.instruction_files', '../outside.md']);
    expect(refused.code).toBe(2);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(before);
});

test('init deletes CLAUDE.md and moves its text to the end of AGENTS.md', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'CLAUDE.md': '# Claude notes\n\nRun the tests.\n',
        'GEMINI.md': '# Keep this\n',
    });
    const preview = await runGspot(sandbox.path, [...INIT, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { plan } = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.write.map((entry) => entry.path)).toContain('AGENTS.md');
    expect(plan.write.map((entry) => entry.path)).not.toContain('GEMINI.md');
    expect(plan.remove).toContainEqual({ path: 'CLAUDE.md', note: 'its own text moves to the end of AGENTS.md' });
    expect(await readFile(join(sandbox.path, 'CLAUDE.md'), 'utf8')).toBe('# Claude notes\n\nRun the tests.\n');
    const installed = await runGspot(sandbox.path, INIT);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(currentBlock(agents, { path: 'AGENTS.md', style: 'markdown' })).toContain('WORKING.md');
    expect(agents).toEndWith('<<< -->\n\n## Other instructions\n\n# Claude notes\n\nRun the tests.\n');
    expect(await readFile(join(sandbox.path, 'GEMINI.md'), 'utf8')).toBe('# Keep this\n');
});

test('disabled agent rules preserve authored instructions during init, preview, and later apply', async () => {
    await using sandbox = await testdir();
    const authored = '# Claude notes\n';
    await createFileTree(sandbox.path, { 'CLAUDE.md': authored });
    const args = [...INIT, '--no-rules'];
    const preview = await runGspot(sandbox.path, [...args, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { plan } = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.write.map(({ path }) => path)).not.toContain('AGENTS.md');
    expect(plan.remove.map(({ path }) => path)).not.toContain('CLAUDE.md');
    expect(await readFile(join(sandbox.path, 'CLAUDE.md'), 'utf8')).toBe(authored);
    const installed = await runGspot(sandbox.path, args);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'CLAUDE.md'), 'utf8')).toBe(authored);
    expect(await pathExists(join(sandbox.path, 'AGENTS.md'))).toBe(false);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'CLAUDE.md'), 'utf8')).toBe(authored);
    expect(await pathExists(join(sandbox.path, 'AGENTS.md'))).toBe(false);
});

test('apply moves an installed CLAUDE.md once and drops the copy of the block', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([]), 'CLAUDE.md': '# Claude notes\n' });
    const first = await runGspot(sandbox.path, ['apply']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    const moved = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    // A `CLAUDE.md` that holds the block and text `AGENTS.md` already has goes without a second copy.
    await createFileTree(sandbox.path, { 'CLAUDE.md': moved });
    const second = await runGspot(sandbox.path, ['apply']);
    expect(second.code, second.stdout + second.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    const current = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(current).toBe(moved);
    expect(moved.match(/## Other instructions/gu)).toHaveLength(1);
});

test.skipIf(!isPosix)('init deletes a CLAUDE.md link and moves nothing', async () => {
    await using sandbox = await testdir();
    await symlink('AGENTS.md', join(sandbox.path, 'CLAUDE.md'));
    const installed = await runGspot(sandbox.path, INIT);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'CLAUDE.md'))).toBe(false);
    const instructions = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(instructions).not.toContain('## Other instructions');
});

test('generated attributes preserve LF through autocrlf checkout', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([]),
        '.gitattributes': '*.txt text\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = '.gspot/rules/general/engineering/agent/WORKING.md';
    const bytes = await readFile(join(sandbox.path, path));
    expect(git(sandbox.path, ['add', '--', '.gitattributes', path]).code).toBe(0);
    const attributes = git(sandbox.path, ['check-attr', 'text', 'eol', 'linguist-generated', '--', path]);
    expect(attributes.code, attributes.stderr).toBe(0);
    expect(attributes.stdout.split('\n').filter(Boolean)).toStrictEqual([
        `${path}: text: set`,
        `${path}: eol: lf`,
        `${path}: linguist-generated: set`,
    ]);
    await rm(join(sandbox.path, path));
    const checked = git(sandbox.path, ['-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path]);
    expect(checked.code, checked.stderr).toBe(0);
    const checkedBytes = await readFile(join(sandbox.path, path));
    expect(checkedBytes).toStrictEqual(bytes);
});
