import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { REJECTED_YAML_OPTIONS } from '#tests/config/cli/generation/yaml.ts';

test.each(['recommended', 'all'] as const)(
    '%s keeps YAML coverage and exclusions in level and ignore policy for every scope',
    (level) => {
        for (const scope of ['', '[scope."app"]\n']) {
            const prefix = scope === '' ? 'tools' : 'scope."app".tools';
            for (const option of REJECTED_YAML_OPTIONS)
                expect(() =>
                    parseStrictPolicy(
                        buildPolicy([], {
                            level,
                            tables: `${scope}[${prefix}.yamllint.rules]\n${option}\n`,
                        }),
                    ),
                ).toThrow('Yamllint rule selection');
            expect(() =>
                parseStrictPolicy(
                    buildPolicy([], {
                        level,
                        tables: `${scope}[${prefix}.yamllint.verbatim]\nextends = "default"\nreason = "Project preference"\n`,
                    }),
                ),
            ).toThrow('verbatim');
            expect(() =>
                parseStrictPolicy(
                    buildPolicy([], {
                        level,
                        tables: `${scope}[${prefix}.yamllint.rules]\ntruthy = { allowed-values = ["yes"] }\nindentation = { spaces = "consistent" }\n`,
                    }),
                ),
            ).not.toThrow();
        }
    },
);
