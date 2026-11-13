import { expect, test } from 'bun:test';

import { selectCheckCode } from '#cli/configurations/registry.ts';
import { formatExplainCommand } from '#cli/engine/outputs/rules.ts';

test.each([
    ['bash/shellcheck', 'SC2086', 'gspot explain bash/shellcheck SC2086'],
    ['repository/encoding', 'path-encoding', 'gspot explain repository/encoding path-encoding'],
    ['repository/encoding', 'unlisted', 'gspot explain repository/encoding'],
    ['typescript/tsc', 'TS2322', 'gspot explain typescript/tsc'],
    ['javascript/eslint', 'import-lite/no-default-export', 'gspot explain javascript/eslint'],
] as const)(
    'the explain command of %s for %s names the rule only when the check has it listed',
    (check, rule, command) => {
        expect(formatExplainCommand({ check, rule }, selectCheckCode)).toBe(command);
    },
);
