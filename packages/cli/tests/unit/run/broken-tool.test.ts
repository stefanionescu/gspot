import { describe, expect, test } from 'bun:test';
import type { CheckSpec } from '#cli/presets/types.ts';
import { isToolBroken } from '#cli/run/broken-tool.ts';

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
