// Generated files withdrawn where the repository keeps its own editor or ESLint configuration.
import { posix } from 'node:path';
import type { Policy } from '#cli/policy/normalize.ts';
import type { FileSnapshot } from '#cli/platform/safe-paths.ts';
import type { GeneratedProposal } from '#cli/lifecycle/apply.ts';
import type { EditorconfigAdoption } from '#cli/policy/schema.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { retainedConfigurationPaths } from '#cli/lifecycle/retained-config.ts';

type Retention = {
    root: string;
    policy: Policy;
    files: TrackedFile[];
    takeover: ReadonlyMap<string, FileSnapshot> | undefined;
};

// The authored configuration files of the tools that the repository keeps.
function retainedPaths(retention: Retention, tools: string[]): string[] {
    const sources = retention.files.filter((file) => file.nature === 'source').map((file) => file.path);
    return retainedConfigurationPaths(retention.root, sources, tools, retention.takeover);
}

// The .editorconfig paths the policy adopts, which stay generated beside retained editor configuration.
function adoptedEditorconfigs(policy: Policy): Set<string> {
    const adopted = policy.tools['editorconfig']?.['adopted'] as EditorconfigAdoption | undefined;
    if (adopted === undefined) return new Set();
    const nested = (adopted.directories ?? []).map((directory) => `${directory.basePath}/.editorconfig`);
    return new Set(['.editorconfig', ...nested]);
}

// Withdraws the formatting files that sit beside a retained Prettier or EditorConfig file.
function retainFormatting(retention: Retention, out: GeneratedProposal): void {
    if (!out.files.some((file) => file.configuration === 'formatting')) return;
    const retained = retainedPaths(retention, ['prettier', 'ec']);
    if (retained.length === 0) return;
    const editorconfigs = adoptedEditorconfigs(retention.policy);
    out.files = out.files.filter(
        (file) =>
            file.configuration !== 'formatting' ||
            file.path.startsWith('.gspot/') ||
            editorconfigs.has(file.path) ||
            retained.every((path) => posix.dirname(path) !== posix.dirname(file.path)),
    );
    out.notes.push(
        ...retained.map(
            (path) => `retained ${path}: editor configuration remains active; gspot checks use generated policy`,
        ),
    );
}

// Withdraws the root ESLint configuration when the repository keeps its own.
function retainEslint(retention: Retention, out: GeneratedProposal): void {
    if (!out.files.some((file) => file.path === '.gspot/config/eslint.config.mjs')) return;
    const retained = retainedPaths(retention, ['eslint']);
    if (retained.length === 0) return;
    out.files = out.files.filter((file) => file.path !== 'eslint.config.mjs');
    out.notes.push(
        ...retained.map(
            (path) =>
                `retained ${path}: authored ESLint configuration remains active; gspot checks use generated policy`,
        ),
    );
}

/**
 * Withdraws the generated files an authored configuration the repository keeps would shadow, noting each one.
 * @param retention the repository, its policy, and the takeover originals
 * @param out the proposal
 */
export function withdrawRetained(retention: Retention, out: GeneratedProposal): void {
    retainFormatting(retention, out);
    retainEslint(retention, out);
}
