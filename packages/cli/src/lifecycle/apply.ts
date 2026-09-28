import type { Generated } from '#cli/types/generation.ts';
import type { WriteRequest } from '#cli/types/lifecycle/apply.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { written, readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { Owner, Planned, ApplyReport } from '#cli/types/lifecycle/lifecycle.ts';
import { READ_ONLY_FILE, EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/platform.ts';

function configurationPlans(owner: Owner, generated: Generated, replace: boolean) {
    const plans: { plan: Planned; package: boolean }[] = [];
    for (const merge of generated.merges) {
        plans.push({
            package: false,
            plan: owner.proposeConfiguration(merge.path, merge.format, merge.changes, replace),
        });
    }
    for (const output of generated.configurations) {
        plans.push({
            package: output.path === 'package.json',
            plan: owner.proposeConfiguration(output.path, output.format, output.changes, true),
        });
    }
    return plans;
}

// Both writing and pruning report preserved files through the same ownership result.
function recordPreserved(report: ApplyReport, plans: Planned[]): void {
    const preserved = plans.filter((plan) => plan.status === 'preserved');
    report.preserved.push(...preserved.map((plan) => plan.path));
    for (const plan of preserved) {
        report.notes.push(`preserved edited or unowned ${plan.path}`);
        if (plan.previous?.original !== undefined)
            report.notes.push(`original for ${plan.path} retained at ${plan.previous.original.backup}`);
    }
}

// Every plan is prepared before the owner writes the batch.
/**
 * Publish and prune generated files using recorded ownership and current snapshots.
 * @param owner the lifecycle owner of the repository
 * @param request generated outputs, pruning policy, and reviewed originals
 */
export function writeGenerated(owner: Owner, request: WriteRequest): void {
    const { root, rendered, report, retained, replace, regenerate } = request;
    const configurations = configurationPlans(owner, rendered, replace !== undefined);
    const authorized = new Map([...(regenerate ?? []), ...(replace ?? [])]);
    const replacements = rendered.files.map((file) => {
        const kind = file.kind === 'lock' || file.kind === 'hook' ? file.kind : 'config';
        // A reviewed original (replace) or a file a merge broke (regenerate) is replaced whatever its bytes are.
        const read = file.kind === 'lock' ? file.read : authorized.get(file.path);
        let mode = file.readOnly ? READ_ONLY_FILE : OWNER_WRITABLE_FILE;
        if (file.executable === true) mode = EXECUTABLE_FILE;
        const replacement = written({ bytes: Buffer.from(file.content), mode }, owner.read(file.path));
        return owner.proposeReplacement(file.path, replacement, kind, read !== undefined, read);
    });
    const blocks = rendered.blocks.map((block) => owner.proposeBlock(block.path, block.block, block.style));
    const generated = [...replacements, ...blocks, ...configurations.map(({ plan }) => plan)];
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
    const plans = [...generated, ...pruning];
    const conflicts = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
    if (replace !== undefined && conflicts.length > 0)
        throw new Error(
            `Setup preserved conflicting outputs: ${conflicts.join(', ')}. Move them aside and run gspot apply; old tool configuration was retained.`,
        );
    owner.applyPlans(plans.filter((plan) => plan.status !== 'preserved'));
    recordPreserved(report, plans);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.blocks.push(...blocks.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    for (const { plan, package: isPackage } of configurations) {
        if (plan.status === 'changed') (isPackage ? report.packages : report.written).push(plan.path);
    }
    report.removed.push(...pruning.filter((plan) => plan.status !== 'preserved').map(({ path }) => path));
}
