import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { hashContent } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseTomlText } from '#cli/settings/file.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

import {
    TEMPLATE_FILE,
    TEMPLATE_IGNORES,
    DESTINATION_FILES,
    TEMPLATE_CUSTOMIZATIONS,
    TEMPLATE_SHELLCHECK_CASES,
    DESTINATION_CONFIGURATIONS,
} from '#tests/data/commands/templates.ts';

test('an exported template sets up another repository', async () => {
    await using first = await testdir();
    await using second = await testdir();
    const environment = { PATH: buildSandboxPath() };
    await prepareTemplate(first.path, environment);

    await createFileTree(second.path, DESTINATION_FILES);
    commitAll(second.path);
    const init = await spawnGspot(
        second.path,
        ['init', '--yes', '--from', join(first.path, TEMPLATE_FILE)],
        environment,
    );
    expect(init.code, init.stdout + init.stderr).toBe(0);
    expect(init.stdout).toContain(`template    ${join(first.path, TEMPLATE_FILE)}`);
    expect(init.stdout).toMatch(/typescript\s+detected/u);
    const [sourceText, exported, copied] = await Promise.all([
        Bun.file(join(first.path, 'gspot.toml')).text(),
        Bun.file(join(first.path, TEMPLATE_FILE)).text(),
        Bun.file(join(second.path, 'gspot.toml')).text(),
    ]);
    const { scope, ...rootSettings } = parseTomlText(sourceText, 'gspot.toml', 'settings');
    expect(scope).toStrictEqual([{ path: 'app', configurations: ['bash'] }]);
    expect(parseTomlText(copied, 'gspot.toml', 'settings')).toStrictEqual({
        ...rootSettings,
        configurations: [...DESTINATION_CONFIGURATIONS],
    });
    expect(copied).toContain(
        `# Copied from template ${join(first.path, TEMPLATE_FILE)}, sha256 ${hashContent(exported)}.\n`,
    );
    expect(await isOnDisk(join(second.path, '.shellcheckrc'))).toBe(false);
    const checked = await spawnGspot(second.path, ['check', '--only', 'sandbox/pass'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);

    await verifyRepeatedExport(second.path, first.path, environment);

    const settled = await Bun.file(join(second.path, 'gspot.toml')).text();
    for (const { files, code } of TEMPLATE_SHELLCHECK_CASES) {
        await createFileTree(second.path, files);
        const shellcheck = await spawnGspot(second.path, ['check', '--only', 'bash/shellcheck'], environment);
        expect(shellcheck.code, shellcheck.stdout + shellcheck.stderr).toBe(code);
        if (code === 1) expect(shellcheck.stdout).toContain('SC2086');
    }
    expect(await Bun.file(join(second.path, 'gspot.toml')).text()).toBe(settled);
});

/** Configure a source repository and export its reusable settings without changing it. */
async function prepareTemplate(path: string, environment: Record<string, string>): Promise<void> {
    await createFileTree(path, {
        'package.json': '{"private":true}\n',
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'app/source.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(path);
    const initialized = await spawnGspot(path, buildInitArguments(['bash']), environment);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const configured = await spawnGspot(path, ['set', 'format.indent_width', '2'], environment);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    for (const { rule, reason, paths } of TEMPLATE_IGNORES) {
        const ignored = await spawnGspot(
            path,
            ['ignore', 'bash/shellcheck', '--rule', rule, '--reason', reason, ...paths],
            environment,
        );
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    }
    const settingsPath = join(path, 'gspot.toml');
    const sourceText = (await Bun.file(settingsPath).text()) + TEMPLATE_CUSTOMIZATIONS;
    await Bun.write(settingsPath, sourceText);
    const saved = await spawnGspot(path, ['export', TEMPLATE_FILE], environment);
    expect(saved.code, saved.stdout + saved.stderr).toBe(0);
    expect(saved.stdout).toContain('belongs to this repository');
    expect(saved.stdout).not.toContain('left out  ignore');
    expect(await Bun.file(settingsPath).text()).toBe(sourceText);
}

/** Check that a second export of the copied settings keeps their content and formatting. */
async function verifyRepeatedExport(path: string, source: string, environment: Record<string, string>): Promise<void> {
    const copied = await Bun.file(join(path, 'gspot.toml')).text();
    const repeated = await spawnGspot(path, ['export', TEMPLATE_FILE], environment);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(repeated.stdout).not.toContain('left out');
    const exported = await Bun.file(join(source, TEMPLATE_FILE)).text();
    const generated = await Bun.file(join(path, TEMPLATE_FILE)).text();
    expect(parseTomlText(generated, TEMPLATE_FILE, 'template')).toStrictEqual({
        ...parseTomlText(exported, TEMPLATE_FILE, 'template'),
        configurations: [...DESTINATION_CONFIGURATIONS],
    });
    const formatted = await spawnGspot(
        path,
        ['check', TEMPLATE_FILE, '--only', 'files/taplo-format', '--json'],
        environment,
    );
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    expect(JSON.parse(formatted.stdout)).toMatchObject({ checks: [{ status: 'passed', findings: [] }] });
    expect(await Bun.file(join(path, 'gspot.toml')).text()).toBe(copied);
}
