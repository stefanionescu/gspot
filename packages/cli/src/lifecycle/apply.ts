import type { GeneratedProposal } from '#cli/types/generation.ts';
import type { WriteRequest } from '#cli/types/lifecycle/apply.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { written, readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { Owner, ApplyReport, FileProposal } from '#cli/types/lifecycle/lifecycle.ts';
import { READ_ONLY_FILE, EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/platform.ts';

function configurationProposals(owner: Owner, generated: GeneratedProposal, replace: boolean) {
    const proposals: { proposal: FileProposal; package: boolean }[] = [];
    for (const merge of generated.merges) {
        proposals.push({
            package: false,
            proposal: owner.proposeConfiguration(merge.path, merge.format, merge.changes, replace),
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

// Both writing and pruning report preserved files through the same ownership result.
function recordPreserved(report: ApplyReport, proposals: FileProposal[]): void {
    const preserved = proposals.filter((proposal) => proposal.status === 'preserved');
    report.preserved.push(...preserved.map((proposal) => proposal.path));
    for (const proposal of preserved) {
        report.notes.push(`preserved edited or unowned ${proposal.path}`);
        if (proposal.previous?.original !== undefined)
            report.notes.push(`original for ${proposal.path} retained at ${proposal.previous.original.backup}`);
    }
}

// Every proposal is prepared before the owner writes the batch.
/**
 * Publish and prune generated files using recorded ownership and current snapshots.
 * @param owner the lifecycle owner of the repository
 * @param request generated outputs, pruning policy, and reviewed originals
 */
export function writeGenerated(owner: Owner, request: WriteRequest): void {
    const { root, rendered, report, retained, replace, regenerate } = request;
    const configurations = configurationProposals(owner, rendered, replace !== undefined);
    const authorized = new Map([...(regenerate ?? []), ...(replace ?? [])]);
    const replacements = rendered.files.map((file) => {
        const kind = file.kind === 'lock' || file.kind === 'hook' ? file.kind : 'config';
        // A reviewed original (replace) or a file a merge broke (regenerate) is replaced whatever its bytes are.
        const observed = file.kind === 'lock' ? file.observed : authorized.get(file.path);
        let mode = file.readOnly ? READ_ONLY_FILE : OWNER_WRITABLE_FILE;
        if (file.executable === true) mode = EXECUTABLE_FILE;
        const replacement = written({ bytes: Buffer.from(file.content), mode }, owner.read(file.path));
        return owner.proposeReplacement(file.path, replacement, kind, observed !== undefined, observed);
    });
    const blocks = rendered.blocks.map((block) => owner.proposeBlock(block.path, block.block, block.style));
    const generated = [...replacements, ...blocks, ...configurations.map(({ proposal }) => proposal)];
    const expected = new Set(['gspot.toml', '.gspot/version', '.gitignore', ...generated.map(({ path }) => path)]);
    // Pruning restores only recorded outputs that no selected owner still needs.
    const recorded = new Set(
        readOwnership(root)
            .files.filter((entry) => ['hook', 'runtime', 'export'].includes(entry.kind))
            .map((entry) => entry.path),
    );
    const pruning = owner
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
    const proposals = [...generated, ...pruning];
    const conflicts = proposals.filter((proposal) => proposal.status === 'preserved').map((proposal) => proposal.path);
    if (replace !== undefined && conflicts.length > 0)
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
