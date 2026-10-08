import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { planRun, configuredChecks, applicableManifests } from '#cli/planning/public.ts';

import {
    FORMAT_POLICY,
    EDITORCONFIG_INPUTS,
    PRETTIER_PATH_IGNORE,
    AUTHORED_IGNORE_CHECK,
} from '#tests/config/cli/planning/format-inputs.ts';

test('EditorConfig selects source files beyond the formatter extensions and omits binary data', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['format']),
        ...EDITORCONFIG_INPUTS,
        'binary.dat': Buffer.from([0, 255, 0]),
    });
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['format/editorconfig-checker'] });
    expect(planned!.files.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        [...Object.keys(EDITORCONFIG_INPUTS), 'gspot.toml'].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(planned!.skip).toBeUndefined();
});

test('check path ignores remove unused Prettier output and remain stable after its ignore file is removed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': FORMAT_POLICY, 'sample.json': '{"value":1}\n' });
    const initial = await openSession(sandbox.path);
    using log = openOwnership(initial.root);
    writeGeneratedFiles(initial, emitAll(initial), log);
    expect(await pathExists(join(sandbox.path, '.gspot/config/prettierignore'))).toBe(true);
    expect(await pathExists(join(sandbox.path, '.gspot/config/prettier.json'))).toBe(true);
    await writeFile(join(sandbox.path, 'gspot.toml'), FORMAT_POLICY + PRETTIER_PATH_IGNORE);
    const excluded = await openSession(sandbox.path);
    const plans = planRun(excluded, { stage: 'commit', skips: [], only: ['format/prettier'] });
    expect(plans[0]?.skip?.cause).toBe('ignore');
    expect(configuredChecks(excluded).map((check) => check.check.name)).not.toContain('format/prettier');
    expect(applicableManifests(excluded).flatMap((manifest) => manifest.tools.map((tool) => tool.name))).not.toContain(
        'prettier',
    );
    const generated = emitAll(excluded);
    expect(generated.files.map((file) => file.path)).not.toContain('.gspot/config/prettier.json');
    const removed = writeGeneratedFiles(excluded, generated, log);
    expect(removed.removed).toContain('.gspot/config/prettierignore');
    expect(await pathExists(join(sandbox.path, '.gspot/config/prettierignore'))).toBe(false);
    const settled = await openSession(sandbox.path);
    expect(configuredChecks(settled).map((check) => check.check.name)).not.toContain('format/prettier');
    const repeated = writeGeneratedFiles(settled, emitAll(settled), log);
    expect(repeated.written).toStrictEqual([]);
    expect(repeated.removed).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(FORMAT_POLICY + PRETTIER_PATH_IGNORE);
    expect(await readFile(join(sandbox.path, 'sample.json'), 'utf8')).toBe('{"value":1}\n');
});

test('a command check declares its native ignore file without borrowing a built-in check name', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': AUTHORED_IGNORE_CHECK,
        'project.ignore': '*.json\n!kept.json\n',
        'ignored.json': '{}\n',
        'kept.json': '{}\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.policyFiles.errors).toStrictEqual([]);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['custom/native-ignore'] });
    expect(plans[0]?.files.map((file) => file.path)).toStrictEqual(['kept.json']);
    expect(plans[0]?.skip).toBeUndefined();
});
