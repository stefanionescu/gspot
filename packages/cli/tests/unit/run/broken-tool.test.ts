import { describe, expect, test } from 'bun:test';
import type { CheckSpec } from '#types/manifest.ts';
import { isToolBroken } from '#cli/run/broken-tool.ts';

const base: Omit<CheckSpec, 'id' | 'output'> = {
    stage: 'commit',
    runs: 'per-file-list',
    inspection: [],
    summary: '',
    why: '',
    help: '',
};
const here = import.meta.dir;

describe('isToolBroken', () => {
    test('a finding on no real file is a crash, and one on a real file is a finding', () => {
        const spec = {
            ...base,
            id: 'docker/trivy-config',
            output: { format: 'regex', pattern: '^(?<file>[^:]+):' },
        } satisfies CheckSpec;
        const bogus = { check: spec.id, file: '2026-09-19T02', message: 'FATAL', fixable: false };
        const real = { check: spec.id, file: 'broken-tool.test.ts', message: 'x', fixable: false };
        expect(isToolBroken(spec, [bogus], [here])).toBe(true);
        expect(isToolBroken(spec, [], [here])).toBe(true);
        expect(isToolBroken(spec, [bogus, real], [here])).toBe(false);
    });

    test('output that names no file, or names a link, is never read as a crash', () => {
        const floor = {
            ...base,
            id: 'vitest/coverage',
            output: { format: 'regex', pattern: '^ERROR: (?<message>.*)$' },
        } satisfies CheckSpec;
        const links = {
            ...base,
            id: 'docs/links',
            output: { format: 'regex', file_is: 'link', pattern: '(?<file>.+)' },
        } satisfies CheckSpec;
        const lines = { ...base, id: 'dependencies/syncpack', output: { format: 'lines' } } satisfies CheckSpec;
        for (const spec of [floor, links, lines]) expect(isToolBroken(spec, [], [here])).toBe(false);
    });
});
