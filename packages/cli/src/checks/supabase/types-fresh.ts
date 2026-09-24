import { readSource } from '#cli/repository/tracked.ts';
// The generated database types, compared with what the CLI writes from the local database.
import { join, posix } from 'node:path';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import { existsSync } from 'node:fs';
import { supabaseFinding } from '#cli/checks/supabase/project.ts';

/**
 * One finding when tools.supabase.types_file differs from the types the CLI writes. Without the setting the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function typesFresh(input: EngineInput): Promise<Finding[]> {
    const named = input.view.tool('supabase')['types_file'];
    if (typeof named !== 'string' || named === '') return [];
    const path = posix.join(input.scope, named);
    const at = { file: path, line: 1 };
    if (!existsSync(join(input.root, path)))
        return [supabaseFinding(input, at, 'types', 'The types file does not exist.')];
    const result = await runCheckCommand(input, ['supabase', 'gen', 'types', 'typescript', '--local'], {
        cwd: join(input.root, input.scope),
    });
    if (result.code !== 0)
        throw new Error(`The supabase CLI wrote no types: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const committed = readSource(input.root, path).toString('utf8');
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
