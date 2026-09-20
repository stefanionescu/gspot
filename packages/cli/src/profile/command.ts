// Saves a reusable policy profile.
import { join } from 'node:path';
import type { CommandResult } from '#types/run.ts';
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
