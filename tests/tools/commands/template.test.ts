// A sandbox's exported template installs its root policy and retains each ignore's applicability.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { contentDigest } from '#cli/platform/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { parseTomlText } from '#cli/policy/document/public.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { buildToolsPath, installToolProjects } from '#tests/harness/install.ts';
import { TEMPLATE_IGNORES, TEMPLATE_CUSTOMIZATIONS } from '#tests/config/tools/commands/template.ts';

const TOOLS = { PATH: buildToolsPath(['ast-grep', 'shellcheck', 'shfmt', 'typos']) };

const first = testdir();

const second = testdir();

const prepareSource = async () => {
    const { path } = await first;
    await createFileTree(path, {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'app/source.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(path);
    const initialized = await spawnGspot(
        path,
        ['init', '--yes', '--configurations', 'bash', '--no-task', '--no-ci', '--no-hooks', '--no-install'],
        TOOLS,
    );
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const configured = await spawnGspot(path, ['set', 'format.indent_width', '2'], TOOLS);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const instructions = await spawnGspot(path, ['set', 'agent_rules.instruction_files', '["AGENT_NOTES.md"]'], TOOLS);
    expect(instructions.code, instructions.stdout + instructions.stderr).toBe(0);
    for (const { rule, reason, paths } of TEMPLATE_IGNORES) {
        const ignored = await spawnGspot(
            path,
            ['ignore', 'bash/shellcheck', '--rule', rule, '--reason', reason, ...paths],
            TOOLS,
        );
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    }
    const policyPath = join(path, 'gspot.toml');
    const sourceText = (await Bun.file(policyPath).text()) + TEMPLATE_CUSTOMIZATIONS;
    await Bun.write(policyPath, sourceText);
    const saved = await spawnGspot(path, ['export', 'house.template.toml'], TOOLS);
    expect(saved.code, saved.stdout + saved.stderr).toBe(0);
    expect(saved.stdout).toContain('left out  scope."app": belongs to this repository');
    expect(saved.stdout).not.toContain('left out  ignore');
    expect(await Bun.file(policyPath).text()).toBe(sourceText);
};

const prepareDestination = async () => {
    const { path } = await second;
    await createFileTree(path, {
        'tools/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'index.ts': 'export const b = 1;\n',
        '.shellcheckrc': 'disable=SC2154\n',
    });
    commitAll(path);
    const source = await first;
    const from = join(source.path, 'house.template.toml');
    const init = await spawnGspot(path, ['init', '--yes', '--from', from, '--no-install'], TOOLS);
    expect(init.code, init.stdout + init.stderr).toBe(0);
    expect(init.stdout).toContain('template    house');
    expect(init.stdout).toContain('detected, not in the template: typescript');
    await installToolProjects(path);
};

const checkRootPolicy = async () => {
    const [source, destination] = await Promise.all([first, second]);
    const sourceText = await Bun.file(join(source.path, 'gspot.toml')).text();
    const exported = await Bun.file(join(source.path, 'house.template.toml')).text();
    const copied = await Bun.file(join(destination.path, 'gspot.toml')).text();
    const { scope, ...rootPolicy } = parseTomlText(sourceText, 'gspot.toml', 'policy');
    expect(scope).toStrictEqual({ app: { configurations: ['bash'] } });
    expect(parseTomlText(copied, 'gspot.toml', 'policy')).toStrictEqual(rootPolicy);
    expect(copied).toContain(`# Copied from template house, sha256 ${contentDigest(exported)}.\n`);
    expect(await pathExists(join(destination.path, 'AGENT_NOTES.md'))).toBe(true);
    expect(await pathExists(join(destination.path, '.shellcheckrc'))).toBe(false);
    const checked = await spawnGspot(destination.path, ['check', '--only', 'sandbox/pass'], TOOLS);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
};

const checkReExport = async () => {
    const { path } = await second;
    const source = await first;
    const copied = await Bun.file(join(path, 'gspot.toml')).text();
    const repeated = await spawnGspot(path, ['export', 'house.template.toml'], TOOLS);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(repeated.stdout).not.toContain('left out');
    const exported = await Bun.file(join(source.path, 'house.template.toml')).text();
    const emitted = await Bun.file(join(path, 'house.template.toml')).text();
    expect(parseTomlText(emitted, 'house.template.toml', 'template')).toStrictEqual(
        parseTomlText(exported, 'house.template.toml', 'template'),
    );
    const formatted = await spawnGspot(
        path,
        ['check', 'house.template.toml', '--only', 'files/taplo-format', '--json'],
        TOOLS,
    );
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    expect(JSON.parse(formatted.stdout)).toMatchObject({ checks: [{ status: 'passed', findings: [] }] });
    expect(await Bun.file(join(path, 'gspot.toml')).text()).toBe(copied);
};

const checkIgnoreApplicability = async () => {
    const { path } = await second;
    const copied = await Bun.file(join(path, 'gspot.toml')).text();
    await Bun.write(join(path, 'tools/b.sh'), '#!/usr/bin/env bash\nunused_variable=hello\n');
    const checked = await spawnGspot(path, ['check', '--only', 'bash/shellcheck'], TOOLS);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    await Bun.write(join(path, 'tools/b.sh'), '#!/usr/bin/env bash\necho $unquoted\n');
    const reported = await spawnGspot(path, ['check', '--only', 'bash/shellcheck'], TOOLS);
    expect(reported.code, reported.stdout + reported.stderr).toBe(1);
    expect(reported.stdout).toContain('SC2086');
    await Bun.write(join(path, 'tools/b.sh'), CLEAN_BASH_SCRIPT);
    await Bun.write(join(path, 'scripts/a.sh'), '#!/usr/bin/env bash\nunquoted="hello world"\necho $unquoted\n');
    const pathAllowed = await spawnGspot(path, ['check', '--only', 'bash/shellcheck'], TOOLS);
    expect(pathAllowed.code, pathAllowed.stdout + pathAllowed.stderr).toBe(0);
    expect(await Bun.file(join(path, 'gspot.toml')).text()).toBe(copied);
};

describe('exported templates', () => {
    afterAll(async () => {
        const [source, destination] = await Promise.all([first, second]);
        await Promise.all([source[Symbol.asyncDispose](), destination[Symbol.asyncDispose]()]);
    });
    beforeAll(prepareSource);
    beforeAll(prepareDestination);
    test('init installs the source root policy with provenance and no source scopes', checkRootPolicy);
    test('re-export retains the customizations and native Taplo reports no formatting findings', checkReExport);
    test(
        'a pathless ignore covers unused variables while a path ignore excludes its neighbor',
        checkIgnoreApplicability,
    );
});
