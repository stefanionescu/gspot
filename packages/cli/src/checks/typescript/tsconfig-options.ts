// Are the required compiler options on in every tsconfig the scope's TypeScript files belong to?
import { join } from 'node:path';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import type { CompilerOptions } from 'typescript';
import { ALL_COMPILER_OPTIONS } from '#cli/checks/typescript/typescript-definitions.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';

function isTsconfigName(path: string): boolean {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return name === 'tsconfig.json' || (name.startsWith('tsconfig.') && name.endsWith('.json'));
}

function missingOptions(input: EngineInput, path: string, options: CompilerOptions): Finding[] {
    return Object.keys(ALL_COMPILER_OPTIONS)
        .filter((option) => options[option] !== true)
        .map((option) => ({
            check: input.spec.name,
            file: path,
            rule: option,
            message: `${option} is not on in this tsconfig.`,
            help: 'Enable this compiler option in the authored TypeScript configuration.',
            fixable: false,
        }));
}

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the engine input for the scope
 * @returns the findings
 */
export function tsconfigOptions(input: EngineInput): Finding[] {
    const scopeTsconfig = input.scope === '' ? 'tsconfig.json' : `${input.scope}/tsconfig.json`;
    const candidates = new Set([
        scopeTsconfig,
        ...input.files.map((file) => file.path).filter((path) => isTsconfigName(path)),
    ]);
    const findings = [...candidates].flatMap((path) => {
        const parsed = getTsconfig(input.root, join(input.root, path));
        if (parsed !== undefined) return missingOptions(input, path, parsed.options);
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
    return findings;
}
