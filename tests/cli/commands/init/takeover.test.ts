import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { prepare } from '#cli/commands/init/public.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeSetup } from '#cli/commands/init/contracts.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { identify } from '#cli/lifecycle/ownership/public.ts';
import { parseTemplate } from '#cli/policy/document/contracts.ts';
import { parseToolProject } from '#cli/parsers/packages/contracts.ts';
import { INVALID_CSS, TAKEOVER_PACKAGE } from '#tests/config/samples/css.ts';
import { ownershipSchema } from '#cli/lifecycle/ownership/state/contracts.ts';
import { INACTIVE_CONFIGURATIONS } from '#tests/config/cli/generation/commitlint.ts';
import { rejection, containing, textContaining } from '#tests/harness/expectations.ts';

test('initialization refuses publication of a shared package field edited after preview', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': TAKEOVER_PACKAGE, 'source.css': INVALID_CSS });
    const options = buildInitOptions(sandbox.path, { configurations: ['css'] });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.change).toContainEqual({
        path: 'package.json',
        note: 'managed stylelint fields; other content stays',
    });
    expect(prepared.plan.remove.some((entry) => entry.path === 'package.json')).toBe(false);
    expect(
        prepared.plan.retained.some((entry) => entry.path === 'package.json' && entry.note.includes('stylelint')),
    ).toBe(false);
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(TAKEOVER_PACKAGE);
    const before = await stat(join(sandbox.path, 'package.json'));
    const edited = TAKEOVER_PACKAGE.replace('native-project', 'edited-project');
    await writeFile(join(sandbox.path, 'package.json'), edited);
    expect(await rejection(writeSetup(sandbox.path, options, prepared))).toContain(
        'Lifecycle destination changed during the operation: package.json',
    );
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(edited);
    const after = await stat(join(sandbox.path, 'package.json'));
    expect(after.mode & 0o777).toBe(before.mode & 0o777);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(prepared.policyText);
    const journal = ownershipSchema.parse(
        JSON.parse(await Bun.file(join(sandbox.path, '.gspot/state/ownership.json')).text()),
    );
    expect(journal.pending).toContainEqual(
        containing({
            path: 'package.json',
            before: identify({ bytes: Buffer.from(TAKEOVER_PACKAGE), mode: before.mode & 0o777 }),
        }),
    );
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});

test('initialization does not overwrite a shared file created after its absent-file preview', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}' });
    const options = buildInitOptions(sandbox.path, { configurations: ['dependencies'] });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.change).toContainEqual({
        path: 'bunfig.toml',
        note: 'managed install.minimumReleaseAge fields; other content stays',
    });
    const authored = '[install]\nexact = true\n';
    await writeFile(join(sandbox.path, 'bunfig.toml'), authored);
    const before = await stat(join(sandbox.path, 'bunfig.toml'));
    expect(await rejection(writeSetup(sandbox.path, options, prepared))).toContain(
        'Lifecycle destination changed during the operation: bunfig.toml',
    );
    expect(await Bun.file(join(sandbox.path, 'bunfig.toml')).text()).toBe(authored);
    const after = await stat(join(sandbox.path, 'bunfig.toml'));
    expect(after.mode & 0o777).toBe(before.mode & 0o777);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(prepared.policyText);
    const journal = ownershipSchema.parse(
        JSON.parse(await Bun.file(join(sandbox.path, '.gspot/state/ownership.json')).text()),
    );
    const pending = journal.pending?.find((entry) => entry.path === 'bunfig.toml');
    expect(pending).toBeDefined();
    expect(pending).not.toHaveProperty('before');
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});

test('recommended initialization keeps authored configurations of inactive strict checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, INACTIVE_CONFIGURATIONS);
    commitAll(sandbox.path);
    const options = buildInitOptions(sandbox.path, {
        configurations: ['none'],
        template: parseTemplate(
            'template = "coverage"\nselection = "detect"\nlevel = "recommended"\n',
            'coverage.template.toml',
        ),
    });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.remove).toStrictEqual([]);
    expect(prepared.plan.change.some((row) => row.path === 'package.json')).toBe(false);
    expect(prepared.plan.write.some((row) => /commitlint|syncpack/u.test(row.path))).toBe(false);
    const initialized = await writeSetup(sandbox.path, options, prepared);
    expect(initialized.exitCode).toBe(0);
    for (const [path, source] of Object.entries(INACTIVE_CONFIGURATIONS))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(source);
    const project = parseToolProject(await Bun.file(join(sandbox.path, '.gspot/package.json')).text());
    expect(project.dependencies).not.toHaveProperty('@commitlint/cli');
    expect(project.dependencies).not.toHaveProperty('syncpack');
});

test('initialization preserves a retained shared configuration edited after its plan', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });
    const options = buildInitOptions(sandbox.path, {
        configurations: ['sql'],
    });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.retained).toContainEqual({
        path: 'setup.cfg',
        note: textContaining('Delete the section when ready'),
    });
    const edited = '[sqlfluff]\nexclude_rules = LT01, RF01\n[flake8]\nignore = E501\n';
    await writeFile(join(sandbox.path, 'setup.cfg'), edited);
    const initialized = await writeSetup(sandbox.path, options, prepared);
    expect(initialized.exitCode).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    expect(await pathExists(join(sandbox.path, '.gspot/config/sqlfluff.cfg'))).toBe(true);
});
