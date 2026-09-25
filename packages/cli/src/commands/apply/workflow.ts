import type { Session } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/targets.ts';
import { publishGenerated } from '#cli/lifecycle/apply.ts';
import type { ApplyReport } from '#cli/lifecycle/apply.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { writePin } from '#cli/lifecycle/version-pin.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { hasPackages, installPackages } from '#cli/tools/vale.ts';
import { resolvePythonProject } from '#cli/tools/python-project.ts';
import { resolvePackageProject } from '#cli/tools/package-project.ts';

async function installProsePackages(session: Session, report: ApplyReport): Promise<void> {
    const isProse = session.scopes.some((selection) =>
        selection.selected.some((manifest) => manifest.configuration.name === 'prose'),
    );
    if (!isProse || hasPackages(session.root, true)) return;
    const problem = await installPackages(session.root);
    if (problem === undefined) report.notes.push('synced the Vale packages into .gspot/config/vale/styles');
    else report.notes.push(`the Vale packages are not synced (${problem}); run gspot apply with the network on`);
}

/**
 * Apply generated proposals through the repository's lifecycle owner.
 * @param session the configuration and repository observations
 * @param takeover reviewed originals authorized for replacement
 * @returns generated changes and preserved files
 */
export async function applyAll(session: Session, takeover?: ReadonlyMap<string, FileSnapshot>): Promise<ApplyReport> {
    return withLifecycleOwner(session.root, async (owner) => {
        if (owner.read('gspot.toml')?.bytes.toString('utf8') !== session.policyFiles.text)
            throw new Error('The gspot.toml file changed after generation was planned. Retry the command.');
        const report: ApplyReport = {
            preserved: [],
            written: [],
            unchanged: [],
            removed: [],
            blocks: [],
            packages: [],
            notes: [],
        };
        const rendered = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
            takeover: takeover,
        });
        await resolvePackageProject(session.root, rendered.files, owner);
        await resolvePythonProject(session.root, rendered.files, owner);
        if (owner.read('gspot.toml')?.bytes.toString('utf8') !== session.policyFiles.text)
            throw new Error('The gspot.toml file changed during tool resolution. Retry the command.');
        report.notes.push(...rendered.notes);
        publishGenerated(
            owner,
            session.root,
            rendered,
            report,
            {
                prose: session.scopes.some((scope) =>
                    scope.selected.some((manifest) => manifest.configuration.name === 'prose'),
                ),
                packages: session.packageManager !== undefined,
            },
            takeover,
        );
        await installProsePackages(session, report);
        const toolInputs = new Set(
            rendered.files
                .filter(
                    (file) =>
                        file.kind === 'lock' ||
                        file.path === '.gspot/package.json' ||
                        file.path === '.gspot/pyproject.toml',
                )
                .map((file) => file.path),
        );
        if (report.written.some((path) => toolInputs.has(path)))
            report.notes.push('Tool dependencies changed. Run: gspot install');
        if (report.preserved.length > 0)
            throw new Error(
                `Apply preserved edited outputs: ${report.preserved.join(', ')}. ${report.notes.join('. ')}. Resolve them and retry; the version pin was not changed.`,
            );
        writePin(session.root);
        return report;
    });
}
