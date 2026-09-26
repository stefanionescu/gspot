import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { createFileTree, testdir } from 'testdirs';
import { parse as parseJsonc } from 'jsonc-parser';
import { emitAll } from '#cli/generation/render.ts';
import { readFileSync, symlinkSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { mergePointer } from '#cli/generation/pointers.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';

test('JSON option keys and YAML values keep their literal structure', async () => {
    const key = 'custom"key\\name\ncafé';
    const value = 'yes: # quoted "value"';
    const extra = { reason: 'An upstream option.', [key]: value };
    const project = 'ios/App: # café.xcodeproj';
    const scheme = 'null';
    const registries = ['null', 'registry.example.com:5000'];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['typescript', 'formatting', 'markdown', 'configs', 'docker', 'swift'],
            tools: {
                prettier: { extra },
                knip: { extra },
                markdownlint: { rules: { [key]: value } },
                yamllint: { rules: { [key]: { level: 'warning' }, indentation: { spaces: 2 } } },
                xcode: { project, scheme },
                hadolint: { trusted_registries: registries },
                trivy: { timeout: '10m', severity: 'HIGH,CRITICAL' },
            },
        }),
    });
    const renderSession5 = await openSession(sandbox.path);
    const output = emitAll(renderSession5.policyFiles.policy, renderSession5.repository, renderSession5.scopes, {
        version: renderSession5.version,
        packageManager: renderSession5.packageManager,
    });
    for (const path of ['.gspot/config/prettier.json', '.gspot/config/knip.json', '.gspot/config/markdownlint.jsonc']) {
        const file = output.files.find((entry) => entry.path === path);
        expect(file).toBeDefined();
        const parsed: unknown = parseJsonc(file!.content);
        expect(parsed).toMatchObject({ [key]: value });
    }
    const markdownCli = output.files.find((entry) => entry.path === '.gspot/config/markdownlint-cli2.mjs')!;
    const markdownPath = join(sandbox.path, markdownCli.path);
    await Bun.write(markdownPath, markdownCli.content);
    const native = Bun.spawnSync(
        [
            process.execPath,
            '-e',
            'const {default: configuration} = await import(process.argv[1]); process.stdout.write(JSON.stringify(configuration.config));',
            pathToFileURL(markdownPath).href,
        ],
        { stdout: 'pipe', stderr: 'pipe' },
    );
    expect(native.exitCode, native.stderr.toString()).toBe(0);
    expect(JSON.parse(native.stdout.toString())).toMatchObject({ [key]: value });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get('.gspot/config/periphery.yml')).toMatchObject({ project, schemes: [scheme] });
    expect(yaml.get('.gspot/config/hadolint.yaml')).toMatchObject({ trustedRegistries: registries });
    expect(yaml.get('.gspot/config/yamllint.yml')).toMatchObject({
        rules: { [key]: { level: 'warning' }, indentation: { spaces: 2 } },
    });
    expect(yaml.get('.gspot/config/trivy.yaml')).toMatchObject({ timeout: '10m', severity: ['HIGH', 'CRITICAL'] });
});

test('shared output readers reject external links without changing their targets', async () => {
    await using sandbox = await testdir();
    const original = '{"scripts":{"check":"gspot check"},"extends":"./.gspot/tsconfig.json"}\n';
    await createFileTree(sandbox.path, { 'project/.keep': '', outside: original });
    const project = join(sandbox.path, 'project');
    symlinkSync(join(sandbox.path, 'outside'), join(project, 'linked.json'));
    const pointer = { path: 'linked.json', merge: { extends: '{target}' } };
    expect(() => mergePointer(project, pointer, pointer.path, '.gspot/tsconfig.json')).toThrow('private regular file');
    expect(() => hasConfiguration(project, { path: pointer.path, format: 'json', changes: [] })).toThrow(
        'private regular file',
    );
    expect(() =>
        hasConfiguration(project, {
            path: pointer.path,
            format: 'json',
            changes: [{ path: ['scripts', 'check'], value: 'gspot check' }],
        }),
    ).toThrow('private regular file');
    expect(() => hasConfiguration(project, { path: pointer.path, format: 'yaml', changes: [] })).toThrow(
        'private regular file',
    );
    expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe(original);
});

test.each(['{"extends":"./.gspot/tsconfig.json", invalid}', 'null', '[]'])(
    'malformed shared JSON fails both emission and drift inspection: %s',
    async (content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'tsconfig.json': content });
        const pointer = { path: 'tsconfig.json', merge: { extends: '{target}' } };
        expect(() => mergePointer(sandbox.path, pointer, pointer.path, '.gspot/tsconfig.json')).toThrow('valid JSON object');
        expect(() => hasConfiguration(sandbox.path, { path: pointer.path, format: 'json', changes: [] })).toThrow(
            'valid JSON object',
        );
        expect(readFileSync(join(sandbox.path, pointer.path), 'utf8')).toBe(content);
    },
);

test('malformed hook and package configuration fails inspection instead of returning empty drift', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'lefthook.yml': 'pre-commit: [\n', 'package.json': '{"scripts":' });
    expect(() => hasConfiguration(sandbox.path, { path: 'lefthook.yml', format: 'yaml', changes: [] })).toThrow(
        'valid YAML mapping',
    );
    expect(() =>
        hasConfiguration(sandbox.path, {
            path: 'package.json',
            format: 'json',
            changes: [{ path: ['scripts', 'check'], value: 'gspot check' }],
        }),
    ).toThrow();
    expect(readFileSync(join(sandbox.path, 'lefthook.yml'), 'utf8')).toBe('pre-commit: [\n');
    expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe('{"scripts":');
});
