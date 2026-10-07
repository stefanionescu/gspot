import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { planRun, configuredChecks } from '#cli/planning/plan.ts';
import { applicableManifests } from '#cli/planning/requirements.ts';

import {
    FORMAT_POLICY,
    EDITORCONFIG_INPUTS,
    PRETTIER_EXCLUSIONS,
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

test('saved native exclusions remove unused Prettier output and remain stable after its ignore file is removed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': FORMAT_POLICY, 'sample.json': '{"value":1}\n' });
    const initial = await openSession(sandbox.path);
    using log = openOwnership(initial.root);
    writeOutputs(initial, log, undefined, emitAll(initial));
    expect(existsSync(join(sandbox.path, '.prettierignore'))).toBe(true);
    expect(existsSync(join(sandbox.path, '.gspot/config/prettier.json'))).toBe(true);
    writeFileSync(join(sandbox.path, 'gspot.toml'), FORMAT_POLICY + PRETTIER_EXCLUSIONS);
    const excluded = await openSession(sandbox.path);
    const plans = planRun(excluded, { stage: 'commit', skips: [], only: ['format/prettier'] });
    expect(plans[0]?.skip?.cause).toBe('ignore');
    expect(configuredChecks(excluded).map((check) => check.check.name)).not.toContain('format/prettier');
    expect(applicableManifests(excluded).flatMap((manifest) => manifest.tools.map((tool) => tool.name))).not.toContain(
        'prettier',
    );
    const generated = emitAll(excluded);
    expect(generated.files.map((file) => file.path)).not.toContain('.gspot/config/prettier.json');
    const removed = writeOutputs(excluded, log, undefined, generated);
    expect(removed.removed).toContain('.prettierignore');
    expect(existsSync(join(sandbox.path, '.prettierignore'))).toBe(false);
    const settled = await openSession(sandbox.path);
    expect(configuredChecks(settled).map((check) => check.check.name)).not.toContain('format/prettier');
    const repeated = writeOutputs(settled, log, undefined, emitAll(settled));
    expect(repeated.written).toStrictEqual([]);
    expect(repeated.removed).toStrictEqual([]);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(FORMAT_POLICY + PRETTIER_EXCLUSIONS);
    expect(readFileSync(join(sandbox.path, 'sample.json'), 'utf8')).toBe('{"value":1}\n');
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
    expect(session.policyFiles.problems).toStrictEqual([]);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['custom/native-ignore'] });
    expect(plans[0]?.files.map((file) => file.path)).toStrictEqual(['kept.json']);
    expect(plans[0]?.skip).toBeUndefined();
});
