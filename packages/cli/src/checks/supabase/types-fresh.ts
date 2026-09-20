// The generated database types, compared with what the CLI writes from the local database.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import { supabaseFinding } from '#cli/checks/supabase/project.ts';

const TYPES_TIMEOUT_MS = 300_000;

/**
 * One finding when tools.supabase.types_file differs from the types the CLI writes. Without the setting the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function typesFresh(input: EngineInput): Promise<Finding[]> {
    const named = input.view.tool('supabase')['types_file'];
    if (typeof named !== 'string' || named === '') return [];
    const at = { file: named, line: 1 };
    if (!existsSync(join(input.root, named)))
        return [supabaseFinding(input, at, 'types', 'The types file does not exist.')];
    const result = await run(['supabase', 'gen', 'types', 'typescript', '--local'], {
        cwd: input.root,
        timeoutMs: TYPES_TIMEOUT_MS,
    });
    if (result.missing) throw new MissingToolError('The supabase CLI is not installed.');
    if (result.code !== 0)
        throw new Error(`The supabase CLI wrote no types: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const committed = readFileSync(join(input.root, named), 'utf8');
    if (committed.trim() === result.stdout.trim()) return [];
    return [
        supabaseFinding(
            input,
            at,
            'types',
            'The file differs from the types the local database gives. Write it again.',
        ),
    ];
}
