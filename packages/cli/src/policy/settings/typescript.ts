import type { Policy } from '#cli/types/policy/settings.ts';
import { COMPILER_OPTIONS, DECORATOR_OPTIONS, RECOMMENDED_OPTIONS } from '#cli/config/policy/typescript.ts';

/**
 * Required compiler diagnostics and framework settings for generation and authored option auditing.
 * @param level the selected check level
 * @param configurations the applicable configurations
 * @returns the required compiler options
 */
export function requiredTsconfigOptions(level: Policy['level'], configurations: string[]): Record<string, boolean> {
    const options = level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS;
    return configurations.includes('nestjs') ? { ...options, ...DECORATOR_OPTIONS } : options;
}
