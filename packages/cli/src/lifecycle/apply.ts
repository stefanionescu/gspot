import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import type { LifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { FileProposal } from '#cli/lifecycle/ownership-journal.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { publicationSnapshot, readOwnership } from '#cli/lifecycle/ownership.ts';
import type { ConfigurationFormat } from '#cli/lifecycle/configuration-document.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE, READ_ONLY_FILE } from '#cli/platform/file-modes.ts';

function configurationProposals(owner: LifecycleOwner, generated: GeneratedProposal, takeover: boolean) {
    const proposals: { proposal: FileProposal; package: boolean }[] = [];
    for (const merge of generated.merges) {
        proposals.push({
            package: false,
            proposal: owner.proposeConfiguration(merge.path, merge.format, merge.changes, takeover),
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

// Pruning restores only locally recorded outputs that no selected owner still needs.
function pruningProposals(
    owner: LifecycleOwner,
    root: string,
    expected: Set<string>,
    retained: { prose: boolean; packages: boolean },
): FileProposal[] {
    const recorded = new Set(
        readOwnership(root)
            .files.filter((entry) => ['hook', 'runtime', 'export'].includes(entry.kind))
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

// Every proposal is prepared before the owner publishes the batch.
/**
 * Publish and prune generated files using recorded ownership and current snapshots.
 * @param owner the lifecycle owner of the repository
 * @param root the repository root
 * @param rendered the generated files to publish
 * @param report receives what changed
 * @param retained what stays out of pruning
 * @param retained.prose whether the prose rule files are kept
 * @param retained.packages whether the package project is kept
 * @param takeover the reviewed originals a takeover replaces, when one was authorized
 * @param regenerate the files a merge broke, replaced whatever their bytes are
 */
export function publishGenerated(
    owner: LifecycleOwner,
    root: string,
    rendered: GeneratedProposal,
    report: ApplyReport,
    retained: { prose: boolean; packages: boolean },
    takeover?: ReadonlyMap<string, FileSnapshot>,
    regenerate: ReadonlyMap<string, FileSnapshot> = new Map(),
): void {
    const configurations = configurationProposals(owner, rendered, takeover !== undefined);
    const replacements = rendered.files.map((file) => {
        const kind = file.kind === 'lock' || file.kind === 'hook' ? file.kind : 'config';
        // A reviewed original (takeover) or a file a merge broke (regenerate) is replaced whatever its bytes are.
        const authorized = takeover?.get(file.path) ?? regenerate.get(file.path);
        return owner.proposeReplacement(
            file.path,
            publicationSnapshot(
                {
                    bytes: Buffer.from(file.content),
                    mode:
                        file.executable === true
                            ? EXECUTABLE_FILE
                            : file.readOnly
                              ? READ_ONLY_FILE
                              : OWNER_WRITABLE_FILE,
                },
                owner.read(file.path),
            ),
            kind,
            file.kind === 'lock' ? file.observed !== undefined : authorized !== undefined,
            file.kind === 'lock' ? file.observed : authorized,
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

export type ApplyReport = {
    preserved: string[];
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};

export type GeneratedFile = {
    rulesPath?: string[];
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    observed?: FileSnapshot;
    kind: 'lock' | 'config' | 'pointer' | 'hook' | 'runner' | 'workflow' | 'rules' | 'managed-block';
    configuration?: string;
};

export type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };

export type ConfigurationOutput = {
    path: string;
    format: ConfigurationFormat;
    changes: { path: (string | number)[]; value: unknown }[];
};

export type GeneratedProposal = {
    notes: string[];
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: ConfigurationOutput[];
    configurations: ConfigurationOutput[];
};
