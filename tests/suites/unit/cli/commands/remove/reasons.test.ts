import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { openSession } from '#cli/planning/session.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

test('remove without --reason exits 2 and writes nothing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash'], { rules: true }) });
    await assertRefusalWithoutWrites(sandbox.path, ['remove', 'bash'], {
        error: 'arguments',
        message:
            "Required option '--reason <text>' not specified. Run gspot remove --help to see its arguments and options.",
    });
});

test('remove keeps the reason of each removed configuration, and add takes a name out and keeps the others', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'python']),
        'source.sh': 'echo example\n',
        'main.py': 'PORT = 8080\n',
    });
    const reason = 'The project uses another language.';
    const first = await runGspot(sandbox.path, ['remove', 'bash', '--reason', 'Bash runs in another project.']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const removed = await runGspot(sandbox.path, ['remove', 'python', '--reason', reason]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout.split('\n', 1)[0]).toBe('Removed python.');
    const contents: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(contents).toHaveProperty('removed_configurations', {
        bash: 'Bash runs in another project.',
        python: reason,
    });
    const added = await runGspot(sandbox.path, ['add', 'bash']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const removedSettings: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(removedSettings).toHaveProperty('removed_configurations', { python: reason });
    const restored = await runGspot(sandbox.path, ['add', 'python']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    const restoredSettings: unknown = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(restoredSettings).not.toHaveProperty('removed_configurations');
});

test('removing automatically selected licenses records the choice for the next session', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"name":"example","private":true,"dependencies":{"react":"19.1.1"}}\n',
    });
    const removed = await runGspot(sandbox.path, [
        'remove',
        'licenses',
        '--reason',
        'Legal reviews licenses outside this repository.',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const text = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(parse(text)).toHaveProperty('removed_configurations', {
        licenses: 'Legal reviews licenses outside this repository.',
    });
    const session = await openSession(sandbox.path);
    expect(
        session.scopes.flatMap((scope) => scope.configurations.map((configuration) => configuration.name)),
    ).not.toContain('licenses');
});

test('the next remove rewrites a shared reason of earlier removals into one reason per configuration', async () => {
    const shared = 'Both languages moved to another repository.';
    const scopeReason = 'The API scope builds no Swift code.';
    await using sandbox = await createGitSandbox({
        'gspot.toml': `configurations = ["markdown"]
removed_configurations = { value = ["bash", "python"], reason = "${shared}" }

[[scope]]
path = "api"
removed_configurations = { value = ["swift"], reason = "${scopeReason}" }

[rules]
enabled = false
`,
        'api/notes.txt': 'API notes\n',
        'notes.md': '# Notes\n',
    });
    const reason = 'Another repository checks the Markdown files.';
    const result = await runGspot(sandbox.path, ['remove', 'markdown', '--reason', reason]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))).toMatchObject({
        removed_configurations: { bash: shared, python: shared, markdown: reason },
        scope: [{ path: 'api', removed_configurations: { swift: scopeReason } }],
    });
});

test.each([
    {
        name: 'records the removal of a detected configuration',
        files: { 'source.sh': 'echo example\n' },
        recorded: true,
    },
    { name: 'records no removal of a configuration that detection does not select', files: {}, recorded: false },
])('remove $name', async ({ files, recorded }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']), ...files });
    const reason = 'The scripts moved to another repository.';
    const result = await runGspot(sandbox.path, ['remove', 'bash', '--reason', reason]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['configurations']).toStrictEqual([]);
    expect(written['removed_configurations']).toStrictEqual(recorded ? { bash: reason } : undefined);
});
