import { join } from 'node:path';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { DECORATOR_OPTIONS } from '#cli/config/checks/typescript.ts';
import type { Finding, EngineInput } from '#cli/types/checks/checks.ts';
import { ALL_COMPILER_OPTIONS } from '#cli/checks/typescript/compiler-options.ts';

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the engine input for the scope
 * @returns the findings
 */
export function tsconfigOptions(input: EngineInput): Finding[] {
    const scopeTsconfig = input.scope === '' ? 'tsconfig.json' : `${input.scope}/tsconfig.json`;
    const candidates = new Set([
        scopeTsconfig,
        ...input.files
            .map((file) => file.path)
            .filter((path) => {
                const name = path.slice(path.lastIndexOf('/') + 1);
                return name === 'tsconfig.json' || (name.startsWith('tsconfig.') && name.endsWith('.json'));
            }),
    ]);
    const required = input.view.kits.includes('nestjs')
        ? { ...ALL_COMPILER_OPTIONS, ...DECORATOR_OPTIONS }
        : ALL_COMPILER_OPTIONS;
    return [...candidates].flatMap((path) => {
        const parsed = getTsconfig(input.root, join(input.root, path));
        if (parsed !== undefined)
            return Object.keys(required)
                .filter((option) => parsed.options[option] !== true)
                .map((option) => ({
                    check: input.spec.name,
                    file: path,
                    rule: option,
                    message: `${option} is not on in this tsconfig.`,
                    help: 'Enable this compiler option in the authored TypeScript configuration.',
                    fixable: false,
                }));
        if (path !== scopeTsconfig) return [];
        return [
            {
                check: input.spec.name,
                file: path,
                message:
                    'This scope has no tsconfig.json. Add an authored TypeScript configuration for its source files.',
                fixable: false,
            },
        ];
    });
}
