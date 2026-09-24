import { mergeForScope } from '#cli/policy/merge.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
// One session per command: the policy, the manifests, the repository, the selection and the merged view per scope.
import { readPolicy } from '#cli/policy/read-policy.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { exposedSettings } from '#cli/policy/settings.ts';
import { npmPins } from '#cli/tools/tool-installation.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';
import type { ToolContext } from '#cli/tools/tool-probe.ts';
import type { PolicyFiles } from '#cli/policy/read-policy.ts';
import type { ExposedSettings } from '#cli/policy/settings.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { toolPackageManager } from '#cli/tools/package-manager.ts';
import type { Manifest } from '#cli/configurations/read-manifests.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';
import type { Repository, SourceObservations } from '#cli/repository/tree.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';

/**
 * Opens a session on a repository that has gspot.toml. Throws PolicyError or SelectionError.
 * @param root the repository root
 * @param policyFiles
 * @returns the session
 */
export async function openSession(root: string, policyFiles: PolicyFiles = readPolicy(root)): Promise<Session> {
    assertPolicyComplete(policyFiles);
    const manifests = configurationManifests();
    const repo = await readRepository(
        root,
        policyFiles.policy.declarations,
        policyFiles.policy.scopes,
        policyFiles.policy.exclude,
    );
    const scopes: ScopeSelection[] = repo.scopes.map((scope) => {
        const selected = selectForScope(policyFiles.policy, scope.path, manifests);
        const surface = exposedSettings(selected);
        const view = mergeForScope(surface, policyFiles.policy, selected, scope.path);
        return { scope, selected, surface, view };
    });
    const runner = policyFiles.policy.runner?.tool;
    const needsPackages =
        Object.keys(
            npmPins(
                scopes.flatMap((scope) => scope.selected),
                runner,
            ),
        ).length > 0;
    const packageManager = needsPackages
        ? await toolPackageManager(
              root,
              repo.files.filter((file) => file.nature === 'source').map((file) => file.path),
          )
        : undefined;
    return {
        ...(packageManager === undefined ? {} : { packageManager }),
        root,
        version: GSPOT_VERSION,
        policyFiles,
        manifests,
        repository: repo,
        scopes,
        probes: new Map(),
        observations: { root, sources: new Map() },
    };
}

export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: ExposedSettings;
    view: MergedView;
};

export type Session = ToolContext & {
    observations: SourceObservations;
    /** Persistent result storage for a disposable revision snapshot. */
    cacheRoot?: string;
    resources?: DisposableStack;
    packageManager?: import('zod').infer<typeof import('#cli/tools/package-manager.ts').packageManagerSchema>;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
};
