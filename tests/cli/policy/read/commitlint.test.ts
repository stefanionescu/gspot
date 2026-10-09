import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { COMMITLINT_REJECTED_SELECTIONS } from '#tests/config/cli/policy/read/commitlint.ts';

test('keeps commitlint severity and coverage with the level in root and scoped settings', () => {
    for (const scope of ['', '[scope."app"]\n']) {
        const table = scope === '' ? 'tools' : 'scope."app".tools';
        for (const selection of COMMITLINT_REJECTED_SELECTIONS)
            expect(() =>
                parseStrictPolicy(
                    buildPolicy(['commits'], {
                        agentRules: true,
                        tables: `${scope}[${table}.commitlint.rules]\nheader-max-length = ${selection}\n`,
                    }),
                ),
            ).toThrow('Commitlint rule selection');
        expect(() =>
            parseStrictPolicy(
                buildPolicy(['commits'], {
                    agentRules: true,
                    tables: `${scope}[${table}.commitlint.verbatim]\nrules = {}\nreason = "Project preference"\n`,
                }),
            ),
        ).toThrow('verbatim');
        expect(() =>
            parseStrictPolicy(
                buildPolicy(['commits'], {
                    agentRules: true,
                    tables: `${scope}[${table}.commitlint]\nscopes = ["Core"]\ntypes = ["fix"]\n[${table}.commitlint.rules]\nheader-max-length = ["always", 40]\n`,
                }),
            ),
        ).not.toThrow();
    }
});
