import { pathMatcher } from '#cli/repository/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { supabaseFinding } from '#cli/checks/supabase/project.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { ADMIN_KEY_NAMES, CODE_EXTENSIONS, DEFAULT_PATHS } from '#cli/constants/checks/supabase.ts';

/**
 * One finding for each line that names the service role key outside tools.supabase.admin_key_files.
 * @param input the engine input
 * @returns the findings
 */
export function adminKey(input: EngineInput): Finding[] {
    const named = input.view.tool('supabase')['admin_key_files'] as string[] | undefined;
    const isAllowed = pathMatcher(named ?? DEFAULT_PATHS);
    const files = input.files.filter(
        (file) =>
            file.nature === 'source' &&
            !isAllowed(input.scope === '' ? file.path : file.path.slice(input.scope.length + 1)) &&
            CODE_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    return files.flatMap((file) =>
        readSource(input.root, file.path, input.observations)
            .toString('utf8')
            .split('\n')
            .flatMap((text, index): Finding[] => {
                if (ADMIN_KEY_NAMES.every((name) => !text.includes(name))) return [];
                const said =
                    'This file names the service role key, which bypasses row level security, outside the paths allowed to hold it.';
                return [supabaseFinding(input, { file: file.path, line: index + 1 }, 'admin-key', said)];
            }),
    );
}
