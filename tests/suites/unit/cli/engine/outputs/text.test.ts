import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';

test('a grouped finding for a file link that leaves the root reports nothing', () => {
    const output = outputSchema.parse({
        format: 'grouped',
        file_pattern: '^Errors in (?<file>.+)$',
        pattern: String.raw`^\[(?<rule>[A-Z0-9]+)\] (?<message>\S+ \| .*)$`,
    });
    const root = resolve('/repo');
    const stdout = [
        'Errors in docs/a.md',
        `[ERROR] ${pathToFileURL(join(root, 'docs/gone.md')).href} | Cannot find file`,
        `[ERROR] ${pathToFileURL(resolve('/v0.1.0/README.md')).href} | Cannot find file`,
    ].join('\n');
    const check = { runs: 'files' as const, id: 'docs/lychee', help: 'Fix it.', output };
    const findings = parseOutput(check, stdout, '', { root, cwd: root });
    expect(findings.map(({ file }) => file)).toStrictEqual(['docs/a.md']);
});
