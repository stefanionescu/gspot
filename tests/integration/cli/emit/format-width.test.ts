import prettier from 'prettier';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { parse as parseYaml } from 'yaml';
import { planRun } from '#cli/execution/plan.ts';
import { emitAll } from '#cli/generation/targets.ts';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { parse as parseJsonc } from 'jsonc-parser';
import { prepareCommand } from '#cli/execution/tool-runner.ts';
import { parse as parseToml, stringify } from 'smol-toml';

test.each([2, 6])('format width %i reaches editors and generated tool configurations', async (width) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': stringify({
            version: 1,
            level: 'all',
            configurations: ['formatting', 'configs', 'python', 'swift', 'sql', 'markdown', 'bash'],
            format: { indent_width: width },
        }),
        'sample.yaml': 'parent:\n child: value\n',
        'sample.sh': 'echo example\n',
    });
    const session = await openSession(directory.path);
    const generated = new Map(
        emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }).files.map((file) => [file.path, file.content]),
    );
    const [shell] = await planRun(session, { stage: 'all', skips: [], only: ['bash/shfmt'] });
    const command = prepareCommand(session, shell!, shell!.spec.command!);
    expect(command.argv[command.argv.indexOf('-i') + 1]).toBe(String(width));
    await Bun.write(join(directory.path, '.editorconfig'), generated.get('.editorconfig')!);
    const path = join(directory.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    expect(editor?.tabWidth).toBe(width);
    const native = JSON.parse(generated.get('.gspot/config/prettier.json')!);
    expect(native.tabWidth).toBe(width);
    expect(parseJsonc(generated.get('.gspot/config/markdownlint.jsonc')!).MD007.indent).toBe(width);
    expect(parseYaml(generated.get('.gspot/config/yamllint.yml')!).rules.indentation.spaces).toBe(width);
    expect(parseToml(generated.get('.gspot/config/ruff.toml')!)['indent-width']).toBe(width);
    expect(parseToml(generated.get('.gspot/config/taplo.toml')!)).toMatchObject({
        formatting: { indent_string: ' '.repeat(width) },
    });
    expect(generated.get('.gspot/config/sqlfluff.cfg')).toContain(`tab_space_size = ${width}`);
    expect(generated.get('.gspot/config/swiftformat')).toContain(`--indent ${width}\n`);
    const source = await Bun.file(path).text();
    const expected = `parent:\n${' '.repeat(width)}child: value\n`;
    expect(await prettier.check(source, { ...editor, filepath: path })).toBe(false);
    expect(await prettier.format(source, { ...editor, filepath: path })).toBe(expected);
    expect(await prettier.format(source, { ...native, filepath: path })).toBe(expected);
    expect(await prettier.check(expected, { ...editor, filepath: path })).toBe(true);
});

test('an explicit YAML width override remains consistent between EditorConfig and Prettier', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['formatting'],
            format: { indent_width: 6, overrides: [{ paths: ['**/*.yaml'], indent_width: 2 }] },
        }),
        'sample.yaml': 'parent:\n child: value\n',
    });
    const renderSession1 = await openSession(directory.path);
    const generated = new Map(
        emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
            version: renderSession1.version,
            packageManager: renderSession1.packageManager,
        }).files.map((file) => [file.path, file.content]),
    );
    await Bun.write(join(directory.path, '.editorconfig'), generated.get('.editorconfig')!);
    await Bun.write(join(directory.path, '.gspot/config/prettier.json'), generated.get('.gspot/config/prettier.json')!);
    await Bun.write(join(directory.path, '.prettierrc.json'), generated.get('.prettierrc.json')!);
    const path = join(directory.path, 'sample.yaml');
    const editor = await prettier.resolveConfig(path, { editorconfig: true, useCache: false });
    const native = await prettier.resolveConfig(path, {
        config: join(directory.path, '.gspot/config/prettier.json'),
        useCache: false,
    });
    expect(editor?.tabWidth).toBe(2);
    expect(native?.tabWidth).toBe(2);
    const root = await prettier.resolveConfig(path, {
        config: join(directory.path, '.prettierrc.json'),
        editorconfig: false,
        useCache: false,
    });
    expect(root?.tabWidth).toBe(2);
    const source = await Bun.file(path).text();
    expect(await prettier.format(source, { ...editor, filepath: path })).toBe('parent:\n  child: value\n');
    expect(await prettier.format(source, { ...native, filepath: path })).toBe('parent:\n  child: value\n');
});
