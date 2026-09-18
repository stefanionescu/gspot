// The ast-grep runner: a preset rule over files, its matches as JSON, counted per enclosing function.
import { join } from 'node:path';
import { locateTool } from '#cli/doctor/probes.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readAsset } from '#cli/platform/assets.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { AstGrepMatch } from '#types/structure.ts';

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
 * @param asset the rule's asset path, such as `presets/bash/rules/shell-branches.yml`
 * @param files the files, relative to the root
 * @returns the matches with zero-based lines, by file, or undefined
 */
export function astGrepMatches(root: string, asset: string, files: string[]): AstGrepMatch[] | undefined {
    const binary = locateTool(root, 'ast-grep');
    if (binary === undefined || files.length === 0) return undefined;
    const rule = ruleFile(root, asset);
    const result = runBlocking([binary, 'scan', '--json=compact', '-r', rule, ...files], { cwd: root });
    if (result.code !== 0 && result.stdout.trim() === '')
        throw new Error(`The ast-grep run failed: ${result.stderr.trim()}`);
    const parsed = JSON.parse(result.stdout === '' ? '[]' : result.stdout) as AstGrepMatch[];
    return parsed.map((match) => ({
        ...match,
        file: match.file.startsWith(root) ? match.file.slice(root.length + 1) : match.file,
    }));
}
