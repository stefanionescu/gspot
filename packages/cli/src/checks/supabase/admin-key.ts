// The key that bypasses row level security, named only where the policy allows it.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { supabaseFinding } from '#cli/checks/supabase/project.ts';
import { CODE_EXTENSIONS, ADMIN_KEY_NAMES } from '#cli/checks/supabase/supabase-definitions.ts';

const DEFAULT_PATHS = [
    'supabase/functions/**',
    'supabase/tests/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/tests/**',
    'scripts/**',
];

/**
 * One finding for each line that names the service role key outside tools.supabase.admin_key_paths.
 * @param input the engine input
 * @returns the findings
 */
export function adminKey(input: EngineInput): Promise<Finding[]> {
    const named = input.view.tool('supabase')['admin_key_paths'] as string[] | undefined;
    const isAllowed = pathMatcher(named ?? DEFAULT_PATHS);
    const files = input.session.repository.files.filter(
        (file) =>
            file.nature === 'source' &&
            !isAllowed(file.path) &&
            CODE_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    const findings = files.flatMap((file) =>
        readFileSync(join(input.root, file.path), 'utf8')
            .split('\n')
            .flatMap((text, index): Finding[] => {
                if (ADMIN_KEY_NAMES.every((name) => !text.includes(name))) return [];
                const said =
                    'This file names the service role key, which bypasses row level security, outside the paths allowed to hold it.';
                return [supabaseFinding(input, { file: file.path, line: index + 1 }, 'admin-key', said)];
            }),
    );
    return Promise.resolve(findings);
}
