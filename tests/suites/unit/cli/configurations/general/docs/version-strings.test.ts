import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('docs/version-strings reports a manifest version in Markdown and test files, and skips changelogs', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs', 'markdown', 'javascript'], { level: 'all' }),
        'package.json': JSON.stringify({ name: 'example', version: '1.2.3' }),
        'pyproject.toml': '[project]\nname = "example"\nversion = "4.5.6"\n',
        'README.md': '# Example\n\nThe 11.2.30 build and the 1.2.3.4 build stay.\n\nRun `npm install example@1.2.3`.\n',
        'CHANGELOG.md': '# 1.2.3\n',
        'tests/version.test.js': "expect(read()).toBe('4.5.6');\n",
        'src/version.js': "export const version = '1.2.3';\n",
    });
    const findings = await runSandboxCheck(sandbox.path, 'docs/version-strings');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'README.md', line: 5, rule: 'version-string' },
        { file: 'tests/version.test.js', line: 1, rule: 'version-string' },
    ]);
});
