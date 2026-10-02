import { z } from 'zod';
import { relative, isAbsolute } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { assetPath } from '#cli/platform/assets.ts';
import { fileBatches } from '#cli/execution/tool/batches.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { EngineInput, AstGrepMatch } from '#cli/types/checks.ts';

const positionSchema = z.object({ line: z.number().int().nonnegative() });

export const matchSchema = z.object({
    file: z.string().min(1),
    ruleId: z.string().min(1),
    range: z.object({ start: positionSchema, end: positionSchema }),
});

/**
 * Runs one rule asset over selected files through shared execution boundaries.
 * @param input the engine input
 * @param asset the rule's asset path, such as `kits/language/bash/rules/branches.yml`
 * @param files the files, relative to the root
 * @returns the matches with zero-based lines, by file
 */
export async function astGrepMatches(input: EngineInput, asset: string, files: string[]): Promise<AstGrepMatch[]> {
    if (files.length === 0) return [];
    const root = input.root;
    const rule = assetPath(asset);
    const command = ['ast-grep', 'scan', '--json=compact', '-r', rule];
    const parsed: AstGrepMatch[] = [];
    for (const batch of fileBatches(files, command, process.platform)) {
        const result = await runCheckCommand(input, [...command, ...batch], { cwd: root });
        if (result.code !== 0 && result.code !== 1) throw new Error(`The ast-grep run failed: ${result.stderr.trim()}`);
        const matches = z.array(matchSchema).parse(JSON.parse(result.stdout));
        parsed.push(...matches);
    }
    const selected = new Set(files);
    return parsed.map((match) => {
        const file = toPosix(isAbsolute(match.file) ? relative(root, match.file) : match.file);
        if (!selected.has(file)) throw new Error(`The ast-grep report names an unselected file: ${file}`);
        return { ...match, file };
    });
}
