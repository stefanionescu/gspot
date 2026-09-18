import { hookBody } from '#cli/emit/hooks.ts';
import { describe, expect, test } from 'bun:test';
import { relativeTarget } from '#cli/emit/stubs.ts';

describe('hooks and stubs', () => {
    test('the hook resolves the binary through GSPOT_BIN or the runner', () => {
        const body = hookBody('pre-commit', 'mise');
        expect(body).toContain("gspot_command=('mise' 'exec' '--' 'gspot')");
        expect(body).toContain('check --staged "$@"');
        expect(hookBody('pre-push', 'none', '/opt/gspot')).toContain('git lfs pre-push');
        expect(hookBody('commit-msg', 'bun')).toContain("('bunx' 'gspot')");
    });

    test('a stub imports its target by a relative path', () => {
        expect(relativeTarget('eslint.config.js', '.gspot/eslint.config.js')).toBe('./.gspot/eslint.config.js');
        expect(relativeTarget('api/tsconfig.json', '.gspot/tsconfig.base.json')).toBe('../.gspot/tsconfig.base.json');
    });
});
