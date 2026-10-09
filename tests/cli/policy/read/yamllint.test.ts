import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { REJECTED_YAML_OPTIONS } from '#tests/config/cli/policy/read/yamllint.ts';

test('keeps YAML coverage and exclusions in level and ignore policy for every scope', () => {
    for (const scope of ['', '[scope."app"]\n']) {
        const prefix = scope === '' ? 'tools' : 'scope."app".tools';
        for (const option of REJECTED_YAML_OPTIONS)
            expect(() =>
                parseStrictPolicy(
                    buildPolicy([], { agentRules: true, tables: `${scope}[${prefix}.yamllint.rules]\n${option}\n` }),
                ),
            ).toThrow('Yamllint rule selection');
        expect(() =>
            parseStrictPolicy(
                buildPolicy([], {
                    agentRules: true,
                    tables: `${scope}[${prefix}.yamllint.verbatim]\nextends = "default"\nreason = "Project preference"\n`,
                }),
            ),
        ).toThrow('verbatim');
        expect(() =>
            parseStrictPolicy(
                buildPolicy([], {
                    agentRules: true,
                    tables: `${scope}[${prefix}.yamllint.rules]\ntruthy = { allowed-values = ["yes"] }\nindentation = { spaces = "consistent" }\n`,
                }),
            ),
        ).not.toThrow();
    }
});
