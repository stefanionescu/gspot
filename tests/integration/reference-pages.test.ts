import * as fs from 'node:fs';
import { join } from 'node:path';
import packageManifest from '../../packages/cli/package.json' with { type: 'json' };
import { expect, spyOn, test } from 'bun:test';
import * as programDefinition from '#cli/program.ts';
import * as manifestDefinitions from '#cli/presets/read-manifests.ts';
import { referencePages } from '../../docs/src/content/reference.ts';
test('command reference includes inherited options and nested usage while omitting hidden internals', () => {
    const program = programDefinition.buildProgram();
    const parent = program
        .command('account')
        .description('Inspect an account')
        .option('--region <name>', 'Select a region');
    parent.command('show <name>').description('Show an account');
    parent.command('internal', { hidden: true }).description('Private operation');
    const build = spyOn(programDefinition, 'buildProgram').mockReturnValue(program);
    try {
        const pages = referencePages();
        const nested = pages.get('commands/account/show.md')!;
        expect(nested).toContain('gspot account show [options] <name>');
        expect(nested).toContain('`--region <name>`');
        for (const flag of ['--json', '--quiet', '--verbose', '--no-color', '-C <dir>']) {
            expect(nested.split(`| \`${flag}\` |`)).toHaveLength(2);
        }
        expect(pages.has('commands/account/internal.md')).toBe(false);
        expect(pages.get('commands/check.md')).not.toContain('--message-file');
    } finally {
        build.mockRestore();
    }
});

test('identical setting definitions list every preset owner and global settings remain visible', () => {
    const settings = referencePages().get('settings.md')!;
    const shared = settings.split('\n').find((line) => line.includes('`tools.openapi.produced_by`'))!;
    expect(shared).toContain('/reference/presets/express/');
    expect(shared).toContain('/reference/presets/fastapi/');
    expect(settings).toContain('`require_reasons`');
});

test('conflicting setting definitions stop reference generation', () => {
    const manifests = new Map(manifestDefinitions.presetManifests());
    const fastapi = structuredClone(manifests.get('fastapi')!);
    const setting = fastapi.settings.find((entry) => entry.name === 'tools.openapi.produced_by')!;
    setting.default = 'a conflicting default';
    manifests.set('fastapi', fastapi);
    const definitions = spyOn(manifestDefinitions, 'presetManifests').mockReturnValue(manifests);
    try {
        expect(() => referencePages()).toThrow('Conflicting setting definition: tools.openapi.produced_by');
    } finally {
        definitions.mockRestore();
    }
});

test('generated source links resolve to their actual owner and display the current product version', () => {
    for (const page of referencePages().values()) {
        const owner =
            /^editUrl: "https:\/\/github.com\/stefanionescu\/gspot\/blob\/(?:main|[a-f0-9]{40})\/(.+)"$/mu.exec(
                page,
            )?.[1];
        expect(owner).toBeDefined();
        expect(fs.statSync(join(import.meta.dir, '../..', owner!)).isFile()).toBe(true);
        expect(page).toContain(`gspot ${packageManifest.version} · [Source definition]`);
    }
});

test('duplicate check identities stop reference loading instead of hiding one owner', () => {
    const manifests = new Map(manifestDefinitions.presetManifests());
    const duplicate = structuredClone(manifests.get('sql')!);
    duplicate.checks.push(duplicate.checks[0]!);
    manifests.set('sql', duplicate);
    const definitions = spyOn(manifestDefinitions, 'presetManifests').mockReturnValue(manifests);
    try {
        expect(() => referencePages()).toThrow('Duplicate check identity:');
    } finally {
        definitions.mockRestore();
    }
});
