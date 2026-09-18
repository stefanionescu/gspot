// gspot profile save and gspot profile check, as functions.
import { join } from 'node:path';
import type { CommandResult } from '#types/run.ts';
import { readProfile } from '#cli/profile/read.ts';
import { savedProfile } from '#cli/profile/save.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { policyPath, readPolicy } from '#cli/policy/read-policy.ts';

/**
 * Writes a profile from the policy of this repository.
 * @param cwd the directory the command runs in
 * @param file the file to write, relative to cwd
 * @returns the command result, with what was left out
 */
export function profileSaveCommand(cwd: string, file: string): Promise<CommandResult> {
    const root = findRoot(cwd);
    readPolicy(root);
    const saved = savedProfile(readFileSync(policyPath(root), 'utf8'), file);
    writeFileSync(file.startsWith('/') ? file : join(cwd, file), saved.text);
    const lines = [`wrote ${file}`, ...saved.leftOut.map((entry) => `left out  ${entry}`)];
    return Promise.resolve({ text: `${lines.join('\n')}\n`, json: { file, leftOut: saved.leftOut }, exitCode: 0 });
}

/**
 * Loads and validates a profile and says what it selects. Writes nothing and needs no repository.
 * @param cwd the directory a relative path starts from
 * @param source a path, an https URL or github:owner/repo
 * @returns the command result
 */
export async function profileCheckCommand(cwd: string, source: string): Promise<CommandResult> {
    const profile = await readProfile(source, cwd);
    const { tables } = profile;
    const presets = tables.presets ?? [];
    const lines = [
        `profile    ${tables.profile}  sha256 ${profile.digest}`,
        `selection  ${tables.selection}`,
        `presets    ${presets.length === 0 ? 'none: the rule files install alone' : presets.join(' ')}`,
    ];
    return { text: `${lines.join('\n')}\n`, json: { ...profile }, exitCode: 0 };
}
