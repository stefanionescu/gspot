// The zod schema of a profile: the policy schema without anything that names a path, with a name and a selection mode.
import { z } from 'zod';
import { policySchema } from '#cli/policy/schema.ts';

/** The tables a profile never holds, because each one belongs to one repository. */
export const REPOSITORY_TABLES = ['scope', 'generated', 'vendored', 'check', 'exclude'] as const;

/** A profile as written. */
export const profileSchema = policySchema
    .omit({ scope: true, generated: true, vendored: true, check: true, exclude: true })
    .extend({
        profile: z.string().min(1),
        selection: z.enum(['exact', 'detect']),
    });

const PATH_KEYS = new Set([
    'paths',
    'patterns',
    'path',
    'file',
    'files',
    'excludeFiles',
    'basePath',
    'ignores',
    'ignore_patterns',
    'glob',
    'harness_directory',
]);

/** Identify repository selectors and local executable registrations that cannot travel in a profile. */
export function isRepositoryPath(key: string, value: unknown): boolean {
    return (
        (key === 'adopted' && typeof value === 'object' && value !== null && 'sections' in value) ||
        PATH_KEYS.has(key) ||
        (key === 'module' && typeof value === 'string' && /^(?:\.|\/|\\|[A-Za-z]:)/u.test(value))
    );
}
