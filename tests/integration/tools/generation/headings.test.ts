import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseAlerts } from '#cli/checks/prose/vale.ts';

test('heading capitalization distinguishes ordinary edge from the browser name and rejects title case', async () => {
    await using directory = await testdir();
    const rule = readFileSync(
        new URL('../../../../packages/cli/configurations/policy/prose/styles/gspot/headings.yml', import.meta.url),
        'utf8',
    );
    await createFileTree(directory.path, {
        'styles/gspot/headings.yml': rule,
        'styles/config/vocabularies/project/accept.txt': 'Bun\n',
        '.vale.ini': 'StylesPath = styles\nVocab = project\n\n[*.md]\nBasedOnStyles = gspot\n',
        'guide.md': '# Guide\n\n## HTTP edge rules\n\n## Microsoft Edge settings\n\n## HTTP Edge Rules\n',
    });
    const result = await run(['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', 'guide.md'], {
        cwd: directory.path,
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(parseAlerts(result.stdout).map((alert) => ({ line: alert.line, check: alert.check }))).toStrictEqual([
        { line: 7, check: 'gspot.headings' },
    ]);
});
