import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { SWIFT_CHECK } from '#tests/config/e2e.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runCheckOnChanges } from '#tests/setup/cli/samples.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';

test('init replaces formatter files, keeps authored notes and CLAUDE.md, and check reports findings until each fix', async () => {
    await using sandbox = await createGspotProject();
    const { root } = sandbox;
    const files = {
        '.editorconfig': `root = true
[*]
indent_size = 2
[*.json]
indent_size = 4
`,
        'prettier.config.mjs':
            'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n',
        'source.js': 'const greeting="hello";',
        'broken.sh': 'if then\n',
        'authored.txt': 'Preserve this authored file.\n',
        'AGENTS.md': '# Team notes\n',
        'CLAUDE.md': `# Claude notes

Run the tests.
`,
    } as const;
    await createFileTree(root, files);
    commitAll(root);
    const initialized = await initSandbox(sandbox.online, {
        configurations: ['bash', 'swift'],
    });
    expect(initialized.stdout + initialized.stderr).not.toContain('formatter std');
    expect(await readFile(join(root, 'prettier.config.mjs'), 'utf8')).not.toBe(files['prettier.config.mjs']);
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toStartWith(files['AGENTS.md']);
    expect({
        claude: await readFile(join(root, 'CLAUDE.md'), 'utf8'),
        authored: await readFile(join(root, 'authored.txt'), 'utf8'),
    }).toStrictEqual({ claude: files['CLAUDE.md'], authored: files['authored.txt'] });
    const checked = parseCheckReport(
        await sandbox.offline.run(root, ['check', '--only', 'bash/shellcheck,format/prettier', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const { checks } = checked.report;
    expect(checks.map(({ check, status }) => ({ check, status }))).toStrictEqual(
        ['bash/shellcheck', 'format/prettier'].map((check) => ({ check, status: 'failed' })),
    );
    expect(new Set(checks[0]!.findings.map(({ file }) => file))).toStrictEqual(new Set(['broken.sh']));
    await writeFile(join(root, 'broken.sh'), 'echo example\n');
    const corrected = parseCheckReport(
        await sandbox.offline.run(root, ['check', '--only', 'bash/shellcheck', '--json']),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'bash/shellcheck', status: 'passed', fileCount: 1, findings: [] },
    ]);
    const level = await sandbox.online.run(root, ['set', 'level', 'all']);
    expect(level.code, level.stdout + level.stderr).toBe(0);
    const named = parseCheckReport(await runCheckOnChanges(sandbox.offline, SWIFT_CHECK));
    expect(named.code, named.stdout + named.stderr).toBe(1);
    expect(named.report.checks.flatMap(({ findings }) => findings)).toMatchObject([SWIFT_CHECK.expected]);
    const renamed = parseCheckReport(
        await runCheckOnChanges(sandbox.offline, { ...SWIFT_CHECK.corrected, check: SWIFT_CHECK.check }),
    );
    expect(renamed.code, renamed.stdout + renamed.stderr).toBe(0);
});
