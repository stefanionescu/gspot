import type { GeneratedProposal } from '#cli/generation/targets.ts';
import type { FileProposal, LifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { publicationSnapshot, readOwnership } from '#cli/lifecycle/ownership.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { parse as parseJsonc } from 'jsonc-parser';

function configurationProposals(owner: LifecycleOwner, generated: GeneratedProposal, takeover: boolean) {
    const proposals: { proposal: FileProposal; package: boolean }[] = [];
    for (const merge of generated.merges) {
        const proposed = parseJsonc(merge.content) as Record<string, unknown>;
        proposals.push({
            package: false,
            proposal: owner.proposeConfiguration(
                merge.path,
                'json',
                merge.keys.map((key) => ({ path: [key], value: proposed[key] })),
                takeover,
            ),
        });
    }
    for (const output of generated.configurations) {
        proposals.push({
            package: output.path === 'package.json',
            proposal: owner.proposeConfiguration(output.path, output.format, output.changes, true),
        });
    }
    return proposals;
}

// Both publication and pruning report preserved files through the same ownership result.
function recordPreserved(report: ApplyReport, proposals: FileProposal[]): void {
    const preserved = proposals.filter((proposal) => proposal.status === 'preserved');
    report.preserved.push(...preserved.map((proposal) => proposal.path));
    for (const proposal of preserved) {
        report.notes.push(`preserved edited or unowned ${proposal.path}`);
        if (proposal.previous?.original !== undefined)
            report.notes.push(`original for ${proposal.path} retained at ${proposal.previous.original.backup}`);
    }
}

// Every proposal is prepared before the owner publishes the batch.
/** Publish and prune generated files using recorded ownership and current snapshots. */
export function publishGenerated(
    owner: LifecycleOwner,
    root: string,
    rendered: GeneratedProposal,
    report: ApplyReport,
    retained: { prose: boolean; packages: boolean },
    takeover?: ReadonlyMap<string, FileSnapshot>,
): void {
    const configurations = configurationProposals(owner, rendered, takeover !== undefined);
    const replacements = rendered.files.map((file) => {
        const kind = file.kind === 'lock' || file.kind === 'hook' ? file.kind : 'config';
        return owner.proposeReplacement(
            file.path,
            publicationSnapshot(
                {
                    bytes: Buffer.from(file.content),
                    mode: file.executable === true ? 0o755 : file.readOnly ? 0o444 : 0o644,
                },
                owner.read(file.path),
            ),
            kind,
            file.kind === 'lock' ? file.observed !== undefined : (takeover?.has(file.path) ?? false),
            file.kind === 'lock' ? file.observed : takeover?.get(file.path),
        );
    });
    const blocks = rendered.blocks.map((block) => owner.proposeBlock(block.path, block.block, block.style));
    const generated = [...replacements, ...blocks, ...configurations.map(({ proposal }) => proposal)];
    const expected = new Set(['gspot.toml', '.gspot/version', '.gitignore', ...generated.map(({ path }) => path)]);
    const pruning = pruningProposals(owner, root, expected, retained);
    const proposals = [...generated, ...pruning];
    const conflicts = proposals.filter((proposal) => proposal.status === 'preserved').map((proposal) => proposal.path);
    if (takeover !== undefined && conflicts.length > 0)
        throw new Error(
            `Setup preserved conflicting outputs: ${conflicts.join(', ')}. Move them aside and run gspot apply; old tool configuration was retained.`,
        );
    owner.applyProposals(proposals.filter((proposal) => proposal.status !== 'preserved'));
    recordPreserved(report, proposals);
    report.written.push(
        ...replacements.filter((proposal) => proposal.status === 'changed').map((proposal) => proposal.path),
    );
    report.unchanged.push(
        ...replacements.filter((proposal) => proposal.status === 'unchanged').map((proposal) => proposal.path),
    );
    report.blocks.push(...blocks.filter((proposal) => proposal.status === 'changed').map((proposal) => proposal.path));
    for (const { proposal, package: isPackage } of configurations) {
        if (proposal.status === 'changed') (isPackage ? report.packages : report.written).push(proposal.path);
    }
    report.removed.push(...pruning.filter((proposal) => proposal.status !== 'preserved').map(({ path }) => path));
}

// Pruning restores only locally recorded outputs that no selected owner still needs.
function pruningProposals(
    owner: LifecycleOwner,
    root: string,
    expected: Set<string>,
    retained: { prose: boolean; packages: boolean },
): FileProposal[] {
    const recorded = new Set(
        readOwnership(root)
            .files.filter((entry) => entry.kind === 'hook' || entry.kind === 'runtime' || entry.kind === 'export')
            .map((entry) => entry.path),
    );
    return owner
        .installedPaths()
        .filter(
            (path) =>
                !(
                    expected.has(path) ||
                    recorded.has(path) ||
                    (retained.prose && isValePackageFile(path)) ||
                    (retained.packages && path.startsWith('.gspot/node_modules/')) ||
                    (expected.has('.gspot/pyproject.toml') && path.startsWith('.gspot/.venv/'))
                ),
        )
        .map((path) => owner.proposeRestoration(path));
}

export type ApplyReport = {
    preserved: string[];
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};
