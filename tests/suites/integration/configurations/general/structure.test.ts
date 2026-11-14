import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/engine/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

const DUPLICATED_METADATA = JSON.stringify(
    Array.from({ length: 40 }, (_, value) => ({ name: `entry-${String(value)}`, value })),
    null,
    4,
);

const SHARED_IMPORTS = Array.from(
    { length: 12 },
    (_, index) => `import { value${String(index)} } from './values/value-${String(index)}.ts';`,
).join('\n');

const SHARED_PYTHON_IMPORTS = Array.from(
    { length: 12 },
    (_, index) =>
        `import module_${String(index)} as alias_${String(index)}\nfrom package_${String(index)} import (\n    first_${String(index)},\n    second_${String(index)},\n)\nfrom package_${String(index)} import third_${String(index)}, \\\n    fourth_${String(index)}`,
).join('\n');

const DUPLICATED_PYTHON_LOGIC = Array.from(
    { length: 20 },
    (_, index) => `    total += values[${String(index)}] * ${String(index + 2)}`,
).join('\n');

const COUNT_STEPS = Array.from(
    { length: 30 },
    (_, index) => `    printf 'step %s of %s\\n' "${String(index)}" "$total"\n    total=$((total + ${String(index)}))`,
).join('\n');

const installedSandbox = shareInstalledSandbox({ configurations: [], files: {} });

const LANGUAGE_SETTINGS = buildSandboxSettings(['bash', 'typescript', 'python'], { level: 'all' });

async function runJscpdCheck(root: string, code: number): Promise<RunReport> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'structure/jscpd', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report;
}

test('structure/jscpd reports a copied Bash function on the second file and ignores identical JSON files', async () => {
    const firstScript = `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_first() {\n    local total=0\n${COUNT_STEPS}\n    printf '%s\\n' "$total"\n}\n\ncount_first\n`;
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': LANGUAGE_SETTINGS,
            'scripts/first.sh': firstScript,
            'metadata/first.json': DUPLICATED_METADATA,
            'metadata/second.json': DUPLICATED_METADATA,
        },
    });
    await runJscpdCheck(root, 0);
    await writeFile(join(root, 'scripts/second.sh'), firstScript.replaceAll('count_first', 'count_second'));
    const report = await runJscpdCheck(root, 1);
    expect(report.checks).toMatchObject([
        {
            check: 'structure/jscpd',
            status: 'failed',
            findings: [
                {
                    check: 'structure/jscpd',
                    file: 'scripts/second.sh',
                    line: 4,
                    rule: 'clone',
                    message: expect.stringContaining('scripts/first.sh:4') as string,
                },
            ],
        },
    ]);
    await writeFile(join(root, 'scripts/second.sh'), '#!/usr/bin/env bash\nprintf "Independent task\\n"\n');
    const corrected = await runJscpdCheck(root, 0);
    expect(corrected.checks).toMatchObject([{ check: 'structure/jscpd', status: 'passed', findings: [] }]);
});

test('structure/jscpd skips an import list that two TypeScript files share and reports a copied function', async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': LANGUAGE_SETTINGS,
            'first.ts': `${SHARED_IMPORTS}\n\nexport const first = value0 + value1;\n`,
            'second.ts': `${SHARED_IMPORTS}\n\nexport const second = value2 * value3;\n`,
        },
    });
    const report = await runJscpdCheck(root, 0);
    expect(report.checks).toMatchObject([{ check: 'structure/jscpd', status: 'passed', findings: [] }]);
    const logic = Array.from(
        { length: 20 },
        (_, index) => `    total += values[${String(index)}] * ${String(index + 2)};`,
    ).join('\n');
    for (const name of ['first', 'second'])
        await writeFile(
            join(root, `${name}.ts`),
            `${SHARED_IMPORTS}\n\nexport function ${name}(values: number[]): number {\n    let total = 0;\n${logic}\n    return total;\n}\n`,
        );
    const copied = await runJscpdCheck(root, 1);
    expect(copied.checks).toMatchObject([
        { check: 'structure/jscpd', status: 'failed', findings: [{ rule: 'clone' }] },
    ]);
});

test('structure/jscpd skips shared Python imports and reports duplicated executable statements', async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': LANGUAGE_SETTINGS,
            'first.py': `${SHARED_PYTHON_IMPORTS}\nprint("first")\n`,
            'second.py': `${SHARED_PYTHON_IMPORTS}\nprint("second")\n`,
        },
    });
    const imports = await runJscpdCheck(root, 0);
    expect(imports.checks).toMatchObject([{ check: 'structure/jscpd', status: 'passed', findings: [] }]);
    for (const name of ['first', 'second']) {
        await writeFile(
            join(root, `${name}.py`),
            `${SHARED_PYTHON_IMPORTS}\ndef ${name}(values):\n    total = 0\n${DUPLICATED_PYTHON_LOGIC}\n    return total\n`,
        );
    }
    const copied = await runJscpdCheck(root, 1);
    expect(copied.checks).toMatchObject([
        { check: 'structure/jscpd', status: 'failed', findings: [{ rule: 'clone' }] },
    ]);
});
