import { describe, expect, test } from 'bun:test';
import { createFixture } from 'fs-fixture';

import { loadPolicy, parseLocalText, parsePolicyText, PolicyError } from '#cli/policy/load.ts';

const minimal = 'version = 1\npresets = ["bash"]\n';

function problems(text: string, root?: string): string[] {
    try {
        parsePolicyText(text, 'gspot.toml', root);
        return [];
    } catch (error) {
        if (error instanceof PolicyError) return error.problems;
        throw error;
    }
}

describe('parsePolicyText', () => {
    test('normalizes reasoned limits into value and reason', () => {
        const policy = parsePolicyText(
            `${minimal}[limits]\nfile_lines = 300\nfunction_lines = { value = 80, reason = "Route tables are one ordered list each." }\n[limits.python]\nfile_lines = 400\n`,
            'gspot.toml',
        );
        expect(policy.limits.root['file_lines']).toEqual({ value: 300 });
        expect(policy.limits.root['function_lines']).toEqual({
            value: 80,
            reason: 'Route tables are one ordered list each.',
        });
        expect(policy.limits.groups['python']?.['file_lines']).toEqual({ value: 400 });
    });

    test('normalizes per-language naming tables and categories', () => {
        const policy = parsePolicyText(
            `${minimal}[naming]\nbanned_terms = ["dispatcher"]\n[naming.python]\nmax_words = 4\n[naming.python.parameters]\nmax_words = { value = 3, reason = "Handler signatures read as one line." }\n`,
            'gspot.toml',
        );
        expect(policy.naming.banned_terms).toEqual(['dispatcher']);
        expect(policy.naming.languages['python']?.max_words).toEqual({ value: 4 });
        expect(policy.naming.languages['python']?.categories['parameters']?.max_words?.reason).toBe(
            'Handler signatures read as one line.',
        );
    });

    test('an unknown key names the keys that exist under that table', () => {
        const found = problems(`${minimal}[hooks]\nmanagr = "gspot"\n`);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('`managr` is not a setting gspot knows under [hooks]');
        expect(found[0]).toContain('`manager`');
    });

    test('an unknown top-level key is refused', () => {
        expect(problems(`${minimal}color = "red"\n`)[0]).toContain(
            '`color` is not a setting gspot knows under the top level',
        );
    });

    test('an ignore without a reason that says something is refused', () => {
        for (const reason of ['', 'N/A', 'TBD', '-', 'because']) {
            const found = problems(`${minimal}[[ignore]]\ncheck = "bash/shellcheck"\nreason = "${reason}"\n`);
            expect(found[0]).toContain('needs a reason that says something');
        }
    });

    test('a bare directory in a selector is refused with the glob to write', () => {
        const found = problems(
            `${minimal}[[ignore]]\ncheck = "bash/shellcheck"\npaths = ["scripts"]\nreason = "One launcher script per environment."\n`,
        );
        expect(found[0]).toContain('Write `scripts/**`');
    });

    test('a rule slot set to off names the ignore line', () => {
        const found = problems(`${minimal}[tools.eslint]\nrules = { "unicorn/no-null" = "off" }\n`);
        expect(found[0]).toContain('gspot ignore');
        expect(found[0]).toContain('--rule unicorn/no-null');
    });

    test('an extra table needs a reason', () => {
        expect(problems(`${minimal}[tools.markdownlint.extra]\nMD044 = false\nreason = ""\n`)[0]).toContain(
            '[tools.markdownlint.extra] needs a `reason`',
        );
    });

    test('a version other than 1 is refused', () => {
        expect(problems('version = 2\n')[0]).toContain('version = 2');
    });

    test('invalid TOML is reported as such', () => {
        expect(problems('version = \n')[0]).toContain('is not valid TOML');
    });

    test('a scope must exist and scopes do not nest', async () => {
        await using fixture = await createFixture({ api: { 'a.txt': '' }, 'api/inner': { 'b.txt': '' } });
        const found = problems(
            `${minimal}[[scope]]\npath = "api"\n[[scope]]\npath = "api/inner"\n[[scope]]\npath = "missing"\n`,
            fixture.path,
        );
        expect(found.some((problem) => problem.includes('`missing` names a directory that does not exist'))).toBe(true);
        expect(found.some((problem) => problem.includes('`api/inner` is inside the scope `api`'))).toBe(true);
    });

    test('a vendored declaration needs a reason', () => {
        expect(problems(`${minimal}[[declare]]\npaths = ["vendor/**"]\nvendored = true\n`)[0]).toContain(
            'needs a reason',
        );
    });
});

describe('parseLocalText', () => {
    test('accepts skip and refuses every other key', () => {
        expect(parseLocalText('skip = ["docker/hadolint"]\n')).toEqual({ skip: ['docker/hadolint'] });
        expect(() => parseLocalText('presets = ["bash"]\n')).toThrow('belongs in gspot.toml');
    });
});

describe('loadPolicy', () => {
    test('reads gspot.toml and gspot.local.toml from a root', async () => {
        await using fixture = await createFixture({
            'gspot.toml': minimal,
            'gspot.local.toml': 'skip = ["bash/shfmt"]\n',
        });
        const loaded = loadPolicy(fixture.path);
        expect(loaded.policy.presets).toEqual(['bash']);
        expect(loaded.local.skip).toEqual(['bash/shfmt']);
    });

    test('a missing gspot.toml points at init', async () => {
        await using fixture = await createFixture({});
        expect(() => loadPolicy(fixture.path)).toThrow('Run `gspot init`');
    });
});
