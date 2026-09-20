import { ESLint } from 'eslint';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { PLANTED_TIMEOUT_MS } from '#tests/harness/planted.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE = `var defaultAnswer: boolean = true;
export function askConfirmation(useDefaults: boolean): boolean {
    return useDefaults && defaultAnswer;
}
export function canAsk(): boolean {
    return false;
}
`;

describe('Boolean naming policy', () => {
    test(
        'accepts action names and stored answers while still reporting a planted lint defect',
        async () => {
            const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: join(ROOT, '.gspot', 'eslint.config.mjs') });
            const reports = await eslint.lintText(SOURCE, {
                filePath: join(ROOT, 'packages/cli/src/output/prompts.ts'),
            });
            const rules = reports.flatMap((report) => report.messages.map((finding) => finding.ruleId));
            expect(rules).toContain('no-var');
            expect(rules).not.toContain('unicorn/consistent-boolean-name');
        },
        PLANTED_TIMEOUT_MS,
    );
});
