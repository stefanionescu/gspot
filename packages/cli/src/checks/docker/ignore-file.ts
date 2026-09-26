import { join } from 'node:path';
import { statSync } from 'node:fs';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';

function isDockerfile(path: string): boolean {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return name === 'Dockerfile' || name.startsWith('Dockerfile.') || name.endsWith('.dockerfile');
}

function folderOf(path: string): string {
    return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function missingEntries(text: string): string[] {
    const lines = new Set(text.split('\n').map((line) => line.trim().replaceAll(/^\/|\/$/gu, '')));
    return DOCKERIGNORE_ENTRIES.filter((entry) =>
        [entry, `**/${entry}`, `${entry}*`, `**/${entry}*`].every((form) => !lines.has(form)),
    );
}

const DOCKERIGNORE_ENTRIES = ['.git', 'node_modules', '.env'];

/**
 * One finding for each Dockerfile folder with no ignore file, or with one that lets a required entry through.
 * @param input the engine input
 * @returns the findings
 */
export function dockerignore(input: EngineInput): Finding[] {
    const dockerfiles = input.files.filter((file) => isDockerfile(file.path));
    const folders = new Map(dockerfiles.map((file) => [folderOf(file.path), file.path]));
    const findings = folders.entries().flatMap(([folder, dockerfile]): Finding[] => {
        const path = folder === '' ? '.dockerignore' : `${folder}/.dockerignore`;
        const base = { check: input.spec.name, line: 1, fixable: false };
        if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
            return [{ ...base, file: dockerfile, rule: 'missing', message: `No ${path} sits beside this Dockerfile.` }];
        const missing = missingEntries(readSource(input.root, path, input.observations).toString('utf8'));
        if (missing.length === 0) return [];
        return [
            { ...base, file: path, rule: 'entries', message: `The ignore file lets through: ${missing.join(', ')}.` },
        ];
    });
    return findings.toArray();
}
