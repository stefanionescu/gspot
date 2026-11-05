import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    { text: 'enabled: true\nenabled: false\n', rule: 'key-duplicates', line: 2 },
    { text: 'enabled: [\n', rule: 'syntax', line: 2 },
    { text: 'value: *missing\n', rule: 'anchors', line: 1 },
    { text: 'value: &unused value\n', rule: 'anchors', line: 1 },
    { text: 'value: &a1 text\ncopy: *a1\n', rule: 'anchor-names', line: 1 },
    { text: 'value: yes\n', rule: 'truthy', line: 1 },
    { text: 'value: True\n', rule: 'truthy', line: 1 },
    { text: 'value: 0123\n', rule: 'octal-values', line: 1 },
    { text: 'value: 0o123\n', rule: 'octal-values', line: 1 },
    { text: 'value: -0123\n', rule: 'octal-values', line: 1 },
    { text: 'value: 1.10\n', rule: 'version-numbers', line: 1 },
    { text: 'value: 1\n---\nvalue: 2\n', rule: 'documents', line: 2 },
    { text: 'defaults: &defaults { value: 1 }\nsettings: { <<: *defaults }\n', rule: 'merge-keys', line: 2 },
    { text: 'value: text # note\n', rule: 'comments', line: 1 },
    { text: 'value: "text" # note\n', rule: 'comments', line: 1 },
    { text: 'value: [one, two] # note\n', rule: 'comments', line: 1 },
    { text: 'value: | # note\n  text\n', rule: 'comments', line: 1 },
])('$rule reports $text', async ({ text, rule, line }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yml': text,
    });
    const findings = await runSandboxCheck(sandbox.path, 'data-files/yaml', { paths: ['settings.yml'] });
    expect(findings.map((finding) => ({ rule: finding.rule, line: finding.line }))).toStrictEqual([{ rule, line }]);
});

test('quoted values, safe booleans, semantic anchors, literal hashes, and pinned action version comments pass', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yml': [
            '# This comment describes the file.',
            'on: [push]',
            'enabled: true',
            'disabled: false',
            'truthy: "yes"',
            'octal: "0123"',
            'version: "1.10"',
            'tagged: !!str yes',
            'count: 0',
            'fraction: 0.25',
            'defaults: &request-timeout 25',
            'timeout: *request-timeout',
            'hash: "value # text"',
            'block: |',
            '  value # text',
            '  # content, not a YAML comment',
            '# This comment describes the next key.',
            'steps:',
            '  - uses: example/action@0123456789abcdef0123456789abcdef01234567 # v1.2.3',
            '',
        ].join('\n'),
    });
    expect(await runSandboxCheck(sandbox.path, 'data-files/yaml', { paths: ['settings.yml'] })).toStrictEqual([]);
});

test('aliases cannot use a later declaration or an anchor from another document', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yml': 'before: *later\nvalue: &later yes\n---\nvalue: *later\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'data-files/yaml', { paths: ['settings.yml'] });
    expect(findings.filter(({ rule }) => rule === 'anchors').map(({ line }) => line)).toStrictEqual([1, 2, 4]);
});

test('a comment after an unpinned action or a comment without a version is reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yml':
            'steps:\n  - uses: example/action@v1 # v1\n  - uses: example/action@0123456789abcdef0123456789abcdef01234567 # action\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'data-files/yaml', { paths: ['settings.yml'] });
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([
        { rule: 'comments', line: 2 },
        { rule: 'comments', line: 3 },
    ]);
});

test('a conventional required YAML filename passes while an application filename needs .yml', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yaml': 'enabled: true\n',
        'pnpm-workspace.yaml': 'packages: []\n',
        'compose.yaml': 'services: {}\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'data-files/yaml', {
        paths: ['settings.yaml', 'pnpm-workspace.yaml', 'compose.yaml'],
    });
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'settings.yaml', rule: 'file-extension' },
    ]);
});

test('empty YAML passes and an empty .yaml file still gets a first-line filename finding', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yml': '',
        'settings.yaml': '',
    });
    const findings = await runSandboxCheck(sandbox.path, 'data-files/yaml', {
        paths: ['settings.yml', 'settings.yaml'],
    });
    expect(findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual([
        { file: 'settings.yaml', line: 1, column: 1, rule: 'file-extension' },
    ]);
});

test('recursive aliases are inspected without expanding their values', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yml': 'value: &recursive { child: *recursive }\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'data-files/yaml', { paths: ['settings.yml'] })).toStrictEqual([]);
});

test('a repeated anchor marks only the declaration resolved by the alias as used', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'settings.yml': 'first: &timeout 25\nsecond: &timeout 30\ncopy: *timeout\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'data-files/yaml', { paths: ['settings.yml'] });
    expect(findings.map(({ rule, line, column }) => ({ rule, line, column }))).toStrictEqual([
        { rule: 'anchors', line: 1, column: 8 },
    ]);
});
