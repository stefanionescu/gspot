import { basename } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { parseAlerts } from '#cli/parsers/output/reports.ts';

test('native acronym checks honor emitted accepted words and retain unknown-word and definition coverage', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose'], { level: 'all' }),
        'guide.md': '# Guide\n\nUse API, URL, HTTP, JSON, SQL and CLI.\n\nUse GPU, APIZ and NQX.\n',
        'definitions.md': '# Guide\n\nGraphics Processing Unit (GPU) handles frames.\n\nUse GPU for frames.\n',
        '.vale.ini': 'StylesPath = styles\nVocab = words\n[*.md]\nBasedOnStyles = gspot\n',
    });
    const before = emitAll(await openSession(directory.path));
    const acronym = before.files.find(({ path }) => path === '.gspot/config/vale/styles/gspot/acronyms.yml')!;
    const words = before.files.find(({ path }) => path.endsWith('/vocabularies/words/accept.txt'))!;
    await createFileTree(directory.path, {
        'styles/gspot/acronyms.yml': acronym.content,
        'styles/config/vocabularies/words/accept.txt': words.content,
    });
    const command = ['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', 'guide.md', 'definitions.md'];
    const unknown = await runTestCommand(command, { cwd: directory.path });
    expect(unknown.code, unknown.stdout + unknown.stderr).toBe(0);
    expect(
        parseAlerts(unknown.stdout).map(({ file, line, message }) => ({ file: basename(file), line, message })),
    ).toStrictEqual(
        ['GPU', 'APIZ', 'NQX'].map((name) => ({
            file: 'guide.md',
            line: 5,
            message: `'${name}' is used without being spelled out on first use.`,
        })),
    );
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose'], { level: 'all', tables: '[words]\nGPU = "The public product name."\n' }),
    });
    const after = emitAll(await openSession(directory.path));
    const authored = after.files.find(({ path }) => path.endsWith('/vocabularies/words/accept.txt'))!;
    await createFileTree(directory.path, { 'styles/config/vocabularies/words/accept.txt': authored.content });
    const named = await runTestCommand(command, { cwd: directory.path });
    expect(named.code, named.stdout + named.stderr).toBe(0);
    expect(
        parseAlerts(named.stdout).map(({ file, line, message }) => ({ file: basename(file), line, message })),
    ).toStrictEqual(
        ['APIZ', 'NQX'].map((name) => ({
            file: 'guide.md',
            line: 5,
            message: `'${name}' is used without being spelled out on first use.`,
        })),
    );
    expect(after.files.find(({ path }) => path === acronym.path)!.content).toBe(acronym.content);
});
