import { z } from 'zod';
import { readAsset } from '#cli/platform/assets.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { fileBatches } from '#cli/run/file-batches.ts';
// The ast-grep runner: a configuration rule over files, its matches as JSON, counted per enclosing function.
import { isAbsolute, join, relative } from 'node:path';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { toPosix, CACHE_DIRECTORY } from '#cli/platform/paths.ts';

const RULE_CACHE = `${CACHE_DIRECTORY}/ast-grep`;
const positionSchema = z.object({ line: z.number().int().nonnegative() });
const matchSchema = z.object({
    file: z.string().min(1),
    ruleId: z.string().min(1),
    range: z.object({ start: positionSchema, end: positionSchema }),
});

function ruleFile(root: string, asset: string): string {
    const path = `${RULE_CACHE}/${asset.slice(asset.lastIndexOf('/') + 1)}`;
    return withLifecycleOwner(root, (owner) => {
        const result = owner.replace(path, { bytes: Buffer.from(readAsset(asset)), mode: 0o444 }, 'runtime');
        if (result === 'preserved') throw new Error(`Retained edited or unowned structural rule: ${path}`);
        return join(root, path);
    });
}

/** A validated native structural match with zero-based line positions. */
export type AstGrepMatch = z.infer<typeof matchSchema>;

/**
 * Runs one rule asset over selected files through shared execution boundaries.
 * @param input the engine input
 * @param asset the rule's asset path, such as `packages/cli/configurations/language/bash/rules/bash-branches.yml`
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
