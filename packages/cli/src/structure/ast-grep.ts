// The ast-grep runner: a preset rule over files, its matches as JSON, counted per enclosing function.
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readAsset } from '#cli/platform/assets.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { fileBatches } from '#cli/run/file-batches.ts';
import type { AstGrepMatch } from '#types/structure.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';

const RULE_CACHE = join('.gspot', 'cache', 'ast-grep');

function ruleFile(root: string, asset: string): string {
    const dir = join(root, RULE_CACHE);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, asset.slice(asset.lastIndexOf('/') + 1));
    writeFileSync(path, readAsset(asset));
    return path;
}

/**
 * Runs one rule asset over files. Returns undefined when ast-grep is not installed.
 * @param root the repository root
 * @param asset the rule's asset path, such as `presets/bash/rules/bash-branches.yml`
 * @param files the files, relative to the root
 * @returns the matches with zero-based lines, by file, or undefined
 */
export function astGrepMatches(root: string, asset: string, files: string[]): AstGrepMatch[] | undefined {
    if (files.length === 0) return [];
    const binary = locateTool(root, 'ast-grep');
    if (binary === undefined) return undefined;
    const rule = ruleFile(root, asset);
    const command = [binary, 'scan', '--json=compact', '-r', rule];
    const parsed: AstGrepMatch[] = [];
    for (const batch of fileBatches(files, command, process.platform)) {
        const result = runBlocking([...command, ...batch], { cwd: root });
        if (result.missing) return undefined;
        if (result.code !== 0 && result.code !== 1) throw new Error(`The ast-grep run failed: ${result.stderr.trim()}`);
        const matches = JSON.parse(result.stdout) as AstGrepMatch[];
        parsed.push(...matches);
    }
    return parsed.map((match) => ({
        ...match,
        file: match.file.startsWith(root) ? match.file.slice(root.length + 1) : match.file,
    }));
}
