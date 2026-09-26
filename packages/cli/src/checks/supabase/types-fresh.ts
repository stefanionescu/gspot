import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readSource } from '#cli/repository/tracked.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { supabaseFinding } from '#cli/checks/supabase/project.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';

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
    if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
        return [supabaseFinding(input, at, 'types', 'The types file does not exist.')];
    const result = await runCheckCommand(input, ['supabase', 'gen', 'types', 'typescript', '--local'], {
        cwd: join(input.root, input.scope),
    });
    if (result.code !== 0)
        throw new Error(`The supabase CLI wrote no types: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const committed = readSource(input.root, path, input.observations).toString('utf8');
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
