import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { requiredTsconfigOptions } from '#cli/policy/settings/typescript.ts';

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the engine input for the scope
 * @returns the findings
 */
export function tsconfig(input: EngineInput): Finding[] {
    const scopeTsconfig = input.scope === '' ? 'tsconfig.json' : `${input.scope}/tsconfig.json`;
    const candidates = new Set([
        scopeTsconfig,
        ...input.files
            .map((file) => file.path)
            .filter((path) => {
                const name = posix.basename(path);
                return name.startsWith('tsconfig.') && name.endsWith('.json');
            }),
    ]);
    const required = requiredTsconfigOptions(input.policyFiles.policy.level, input.view.configurations);
    return [...candidates].flatMap((path) => {
        const parsed = getTsconfig(input.root, join(input.root, path));
        if (parsed !== undefined)
            return Object.keys(required)
                .filter((option) => parsed.options[option] !== true)
                .map((option) => ({
                    ...findingAt(input, { file: path }, option, `${option} is not on in this tsconfig.`),
                    help: 'Enable this compiler option in the authored TypeScript configuration.',
                }));
        return [];
    });
}
