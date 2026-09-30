import { z } from 'zod';
import { createHash } from 'node:crypto';
import { toPosix } from '#cli/platform/paths.ts';
import { readAsset } from '#cli/platform/assets.ts';
import { join, relative, isAbsolute } from 'node:path';
import { openRoot } from '#cli/platform/filesystem.ts';
import { fileBatches } from '#cli/execution/files/batches.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { EngineInput, AstGrepMatch } from '#cli/types/checks.ts';
import { PRIVATE_FILE, CACHE_DIRECTORY } from '#cli/config/platform.ts';

const positionSchema = z.object({ line: z.number().int().nonnegative() });

// The rule file ast-grep reads, named by the hash of its text. It is written when missing or edited, and the cache
// prune ages it out.
function ruleFile(root: string, asset: string): string {
    const bytes = Buffer.from(readAsset(asset));
    const path = `${CACHE_DIRECTORY}/${createHash('sha256').update(bytes).digest('hex')}.yml`;
    const files = openRoot(root);
    try {
        const current = files.read(path);
        if (current?.bytes.equals(bytes) !== true) files.write(path, { bytes, mode: PRIVATE_FILE }, current);
    } finally {
        files.close();
    }
    return join(root, path);
}

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
    const rule = ruleFile(root, asset);
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
