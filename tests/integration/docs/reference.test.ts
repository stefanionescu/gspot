import * as fs from 'node:fs';
import { join } from 'node:path';
import plugin from '#plugin/plugin.ts';
import { expect, spyOn, test } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import * as programDefinition from '#cli/commands/program.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { referencePages } from '#docs/src/content/reference/loader.ts';
import * as manifestDefinitions from '#cli/configurations/manifests.ts';

test('command reference includes inherited options and nested usage while omitting hidden internals', () => {
    const program = programDefinition.buildProgram();
    const parent = program
        .command('account')
        .summary('Inspect accounts')
        .description('Inspect an account')
        .addHelpText('after', '\nEffects:\nRead an account.\n\nExit codes:\n0: complete.\n\nExample:\ngspot account')
        .option('--region <name>', 'Select a region');
    parent
        .command('show <name>')
        .summary('Show an account')
        .description('Show an account')
        .addHelpText(
            'after',
            '\nEffects:\nRead one account.\n\nExit codes:\n0: complete.\n\nExample:\ngspot account show example',
        );
    parent.command('internal', { hidden: true }).description('Private operation');
    const build = spyOn(programDefinition, 'buildProgram').mockReturnValue(program);
    try {
        const pages = referencePages();
        const nested = pages.get('commands/account/show.md')!.body;
        expect(nested).toContain('gspot account show [options] <name>');
        expect(nested).toContain('`--region <name>`');
        for (const flag of ['--json', '--quiet', '--verbose', '--no-color', '-C <dir>']) {
            expect(nested.split(`| \`${flag}\` |`)).toHaveLength(2);
        }
        expect(pages.has('commands/account/internal.md')).toBe(false);
        expect(pages.get('commands/check.md')?.body).not.toContain('--message-file');
    } finally {
        build.mockRestore();
    }
});

test('identical setting definitions list every configuration owner and global settings remain visible', () => {
    const settings = referencePages().get('settings.md')!.body;
    const shared = settings.split('\n').find((line) => line.includes('`tools.openapi.produced_by`'))!;
    expect(shared).toContain('/reference/configurations/express/');
    expect(shared).toContain('/reference/configurations/fastapi/');
    expect(settings).toContain('`require_reasons`');
});

test('conflicting setting definitions stop reference generation', () => {
    const manifests = new Map(manifestDefinitions.configurationManifests());
    const fastapi = structuredClone(manifests.get('fastapi')!);
    const setting = fastapi.settings.find((entry) => entry.name === 'tools.openapi.produced_by')!;
    setting.kind = 'boolean';
    manifests.set('fastapi', fastapi);
    const definitions = spyOn(manifestDefinitions, 'configurationManifests').mockReturnValue(manifests);
    try {
        expect(() => referencePages()).toThrow('Conflicting setting definition: tools.openapi.produced_by');
    } finally {
        definitions.mockRestore();
    }
});

test('configuration-specific defaults retain distinct values and their owning configurations', () => {
    const rows = referencePages()
        .get('settings.md')!
        .body.split('\n')
        .filter((line) => line.includes('`tools.sqlfluff.dialect`'));
    expect(rows).toHaveLength(2);
    expect(rows.find((line) => line.includes('`"ansi"`'))).toContain('/reference/configurations/sql/');
    expect(rows.find((line) => line.includes('`"postgres"`'))).toContain('/reference/configurations/postgres/');
});

test('generated source links resolve to their actual owner and display the current product version', () => {
    for (const page of referencePages().values()) {
        const owner = /^https:\/\/github.com\/stefanionescu\/gspot\/blob\/(?:main|[a-f0-9]{40})\/(.+)$/u.exec(
            page.data.editUrl,
        )?.[1];
        expect(owner).toBeDefined();
        expect(fs.statSync(join(import.meta.dir, '../../..', owner!)).isFile()).toBe(true);
        expect(page.body).toContain(`gspot ${packageManifest.version} · [Source definition]`);
    }
});

test('duplicate check identities stop reference loading instead of hiding one owner', () => {
    const manifests = new Map(manifestDefinitions.configurationManifests());
    const duplicate = structuredClone(manifests.get('sql')!);
    duplicate.checks.push(duplicate.checks[0]!);
    manifests.set('sql', duplicate);
    const definitions = spyOn(manifestDefinitions, 'configurationManifests').mockReturnValue(manifests);
    try {
        expect(() => referencePages()).toThrow('Duplicate check identity:');
    } finally {
        definitions.mockRestore();
    }
});

test('command references render definition-owned effects, exits, and examples', () => {
    const program = programDefinition.buildProgram();
    program
        .command('sample')
        .description('Sample command')
        .addHelpText('after', '\nEffects:\nReads the sample.\n\nExit codes:\n0: complete.\n\nExample:\ngspot sample');
    const build = spyOn(programDefinition, 'buildProgram').mockReturnValue(program);
    try {
        const pages = referencePages();
        expect(pages.get('commands/sample.md')?.body).toContain('Reads the sample.');
        expect(pages.get('commands/check.md')?.body).toContain('invalid reports');
        expect(pages.get('commands/check.md')?.body).toContain('/packages/cli/src/commands/check/command.ts');
        expect(pages.get('commands/completion.md')?.body).toContain('/packages/cli/src/commands/completion.ts');
        expect(pages.get('commands/apply.md')?.body).toContain('without writing project files');
        expect(pages.get('commands/doctor.md')?.body).toContain('1: a selected tool or hook');
        const settings = pages.get('settings.md')!.body;
        const policy = /```toml\n([\s\S]*?)```/u.exec(settings)?.[1];
        expect(policy).toBeDefined();
        expect(
            parsePolicyText(policy!, 'reference settings').scopeTables['app']?.limits?.root['file_lines']?.value,
        ).toBe(100);
        expect(pages.get('rules/bash/syntax.md')?.body).toContain('## Defect and correction');
    } finally {
        build.mockRestore();
    }
});

test('reference generation rejects a public command without behavioral documentation', () => {
    const program = programDefinition.buildProgram();
    program.command('undocumented').description('Missing behavioral content');
    const build = spyOn(programDefinition, 'buildProgram').mockReturnValue(program);
    try {
        expect(() => referencePages()).toThrow('Command undocumented has no effects, exits, or example documentation');
    } finally {
        build.mockRestore();
    }
});

test('check references invoke the reporting check and expose execution restrictions', () => {
    const pages = referencePages();
    const json = pages.get('rules/configs/json.md')!.body;
    expect(json).toContain('gspot check --stage commit --only formatting/prettier --no-cache');
    expect(json).not.toContain('--only configs/json');
    expect(json).toContain('gspot ignore formatting/prettier --paths');
    expect(json).not.toContain('gspot ignore configs/json');
    expect(json).toContain('This entry does not execute a separate check.');
    expect(json).toContain('Scope: follows the reporting check.');
    expect(pages.get('rules/bash/syntax.md')?.body).toContain('selected file lists under the applicable scope policy');
    expect(pages.get('rules/nextjs/build.md')?.body).toContain('`tools.next.build_in_gate`; skipped until configured.');
    expect(pages.get('rules/nextjs/build.md')?.body).toContain(
        'each selected scope, excluding files owned by child scopes',
    );
    expect(pages.get('rules/xctest/coverage.md')?.body).toContain('Platform selection: macos');
});

test('plugin references reject an empty example before publishing pages', () => {
    const rule = plugin.rules['no-trivial-files'];
    const docs = rule.meta.docs!;
    const original = docs.example;
    try {
        docs.example = ' '.repeat(3);
        expect(() => referencePages()).toThrow('Plugin rule no-trivial-files has no example.');
    } finally {
        docs.example = original;
    }
    expect(referencePages().get('plugin/no-trivial-files.md')?.body).toContain(original);
});

test('reference titles come from their definitions and exact rule identifiers remain searchable', () => {
    const pages = referencePages();
    const program = programDefinition.buildProgram();
    for (const command of program.createHelp().visibleCommands(program)) {
        if (command.name() === 'help') continue;
        expect(command.summary().trim().length).toBeGreaterThan(0);
        const page = pages.get(`commands/${command.name()}.md`)!.body;
        expect(pages.get(`commands/${command.name()}.md`)!.data.title).toBe(command.summary());
        expect(page).toContain(`gspot ${command.name()}`);
    }
    for (const manifest of manifestDefinitions.configurationManifests().values()) {
        for (const check of manifest.checks) {
            expect(check.title?.trim().length).toBeGreaterThan(0);
            const page = pages.get(`rules/${check.name}.md`)!.body;
            expect(page).toContain(check.name);
            expect(pages.get(`rules/${check.name}.md`)!.data.title).toBe(check.title!);
        }
    }
    for (const [name, rule] of Object.entries(plugin.rules)) {
        const page = pages.get(`plugin/${name}.md`)!.body;
        expect(page).toContain(`gspot/${name}`);
        expect(pages.get(`plugin/${name}.md`)!.data.title).toBe(rule.meta.docs!.title);
    }
});
