import { Glob } from 'bun';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listCodeFences } from '#cli/parsers/formats/markdown.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const folder = join(REPOSITORY_ROOT, 'packages/cli/src/configurations');
const blocks = [...new Glob('**/rules/*.md').scanSync(folder)].flatMap((path) =>
    listCodeFences(readFileSync(join(folder, path), 'utf8')).map((fence) => ({ path, ...fence })),
);

test('the shell examples of the rule files document their functions', async () => {
    const scripts = blocks.filter(({ language }) => language === 'bash');
    const files = Object.fromEntries(
        scripts.map(({ path, startLine, body }) => [
            `examples/${path.replaceAll('/', '-')}-${String(startLine)}.sh`,
            `#!/usr/bin/env bash\n${body}\n`,
        ]),
    );
    await using sandbox = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/doc-comments');
    expect(findings.map(({ file, rule, message }) => `${file}: ${String(rule)}: ${message}`)).toStrictEqual([]);
});

test.each([
    { language: 'ts', extension: 'ts', configuration: 'typescript' },
    { language: 'python', extension: 'py', configuration: 'python' },
])('the $language examples of the rule files pass the naming check', async ({ language, extension, configuration }) => {
    const examples = blocks.filter((block) => block.language === language);
    const files = Object.fromEntries(
        examples.map(({ path, startLine, body }) => [
            `examples/${path.replaceAll('/', '-').toLowerCase().replaceAll('.', '-')}-${String(startLine)}.${extension}`,
            `${body}\n`,
        ]),
    );
    await using sandbox = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ file, line, message }) => `${file}:${String(line)}: ${message}`)).toStrictEqual([]);
});
