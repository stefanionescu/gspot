import type { CheckSpec } from '#cli/configurations/schema.ts';
import { isToolBroken, toolOutputDetail } from '#cli/execution/broken-tool.ts';
import { describe, expect, test } from 'bun:test';

const base = {
    name: 'sandbox/diagnostic',
    command: ['tool'],
    level: 'recommended',
    stage: 'commit',
    runs: 'per-file-list',
    coverage: [],
    summary: '',
    why: '',
    help: '',
} satisfies CheckSpec;
const here = import.meta.dir;

test('bounded failure output retains the final diagnostic from both streams', () => {
    const progress = Array.from({ length: 30 }, (_, index) => `progress ${String(index)}`).join('\n');
    const detail = toolOutputDetail(
        {
            code: 1,
            stdout: `${progress}\nstdout failure`,
            stderr: `${progress}\nstderr failure`,
            missing: false,
            duration: 1,
        },
        'empty',
    );
    expect(detail).toContain('stdout failure');
    expect(detail).toContain('stderr failure');
    expect(detail).not.toContain('progress 0\n');
    expect(detail.split('\n')).toHaveLength(40);
});

describe('isToolBroken', () => {
    test('a finding on no real file is a crash, and one on a real file is a finding', () => {
        const spec = {
            ...base,
            name: 'docker/trivy-config',
            output: { format: 'regex', pattern: '^(?<file>[^:]+):' },
        } satisfies CheckSpec;
        const bogus = { check: spec.name, file: '2026-09-19T02', message: 'FATAL', fixable: false };
        const real = { check: spec.name, file: 'broken-tool.test.ts', message: 'x', fixable: false };
        expect(isToolBroken(spec, [bogus], [here])).toBe(true);
        expect(isToolBroken(spec, [], [here])).toBe(true);
        expect(isToolBroken(spec, [bogus, real], [here])).toBe(false);
    });

    test('output that names no file, or names a link, is never read as a crash', () => {
        const floor = {
            ...base,
            name: 'vitest/coverage',
            output: { format: 'regex', pattern: '^ERROR: (?<message>.*)$' },
        } satisfies CheckSpec;
        const links = {
            ...base,
            name: 'docs/links',
            output: { format: 'regex', file_is: 'link', pattern: '(?<file>.+)' },
        } satisfies CheckSpec;
        const lines = { ...base, name: 'dependencies/syncpack', output: { format: 'lines' } } satisfies CheckSpec;
        for (const spec of [floor, links, lines]) expect(isToolBroken(spec, [], [here])).toBe(false);
    });
});
