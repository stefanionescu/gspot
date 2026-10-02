import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { DEFAULT_PATHS, ADMIN_KEY_NAMES, CODE_EXTENSIONS } from '#cli/config/checks/platform/supabase.ts';

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
            file.kind === 'source' &&
            !isAllowed(input.scope === '' ? file.path : file.path.slice(input.scope.length + 1)) &&
            CODE_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    return files.flatMap((file) =>
        readSource(input.root, file.path, input.reads)
            .toString('utf8')
            .split('\n')
            .flatMap((text, index): Finding[] => {
                if (ADMIN_KEY_NAMES.every((name) => !text.includes(name))) return [];
                const said =
                    'This file names the service role key, which bypasses row level security, outside the paths allowed to hold it.';
                return [findingAt(input, { file: file.path, line: index + 1 }, 'admin-key', said)];
            }),
    );
}
