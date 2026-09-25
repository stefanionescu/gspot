import type { CheckSpec } from '#cli/configurations/schema.ts';
import { hasToolError, isToolBroken, toolOutputDetail } from '#cli/execution/broken-tool.ts';
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

describe('hasToolError', () => {
    const output = { code: 1, stdout: '', stderr: 'Oops! Something went wrong\n', missing: false, duration: 1 };
    const eslint = { name: 'eslint', windows: true, installers: {}, crash_pattern: '^Oops! Something went wrong' };

    test("the tool's crash pattern reads a fall-over for every check that runs it", () => {
        expect(hasToolError(base, eslint, output)).toBe(true);
        expect(hasToolError(base, eslint, { ...output, stderr: '1 problem\n' })).toBe(false);
        expect(hasToolError(base, undefined, output)).toBe(false);
    });

    test("a check's own pattern comes before the tool's", () => {
        const spec = { ...base, tool_errors: '^Fatal:' } satisfies CheckSpec;
        expect(hasToolError(spec, eslint, output)).toBe(false);
        expect(hasToolError(spec, eslint, { ...output, stderr: 'Fatal: cannot write\n' })).toBe(true);
    });
});
