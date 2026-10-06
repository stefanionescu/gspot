// One session per command: the policy, the manifests, the repository, the selection, and the merged view per scope.
import { npmPins } from '#cli/tools/pins.ts';
import { readPolicy } from '#cli/policy/read.ts';
import { readRepository } from '#cli/repository/read.ts';
import { scopeView } from '#cli/policy/settings/view.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { RUNNING_VERSION } from '#cli/config/platform/runtime.ts';
import type { ScopeEntry } from '#cli/types/repository/inventory.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';
import { FILE_PREFIX_BYTES } from '#cli/config/repository/inventory.ts';
import { acquirePythonInstaller } from '#cli/tools/python/installer.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';
import type { Policy, PolicyFile, ScopeSelection } from '#cli/types/policy/settings.ts';
import { selectPackageInstaller, inspectPackageInstaller } from '#cli/tools/npm/installer.ts';
import type { PackageInstaller, PackageInstallerIdentity } from '#cli/types/parsers/packages.ts';

// Resolves every scope: its selected configurations, settings surface, and merged view.
function scopeSelections(policy: Policy, scopes: ScopeEntry[], manifests: Map<string, Manifest>): ScopeSelection[] {
    return scopes.map((scope) => {
        const selected = selectForScope(policy, scope.path, manifests);
        const surface = knownSettings(selected, policy.level);
        const view = scopeView(surface, policy, selected, scope.path);
        return { scope, selected, surface, view };
    });
}

/**
 * Opens a repository session. Throws GspotError (policy or selection) when gspot.toml or configuration selection is invalid.
 * @param root the repository root
 * @param policyFiles the policy as read, read here by default
 * @returns the session
 */
export async function openSession(root: string, policyFiles: PolicyFile = readPolicy(root)): Promise<Session> {
    const manifests = configurationManifests();
    const { policy } = policyFiles;
    const repository = await readRepository(root, policy.declarations, policy.scopes, policy.exclude);
    // Init plans native configuration before the policy becomes a tracked file.
    if (!repository.files.some((file) => file.path === POLICY_FILE) && !pathMatcher(policy.exclude)(POLICY_FILE)) {
        const bytes = Buffer.from(policyFiles.text);
        repository.files.push({
            path: POLICY_FILE,
            prefix: bytes.subarray(0, FILE_PREFIX_BYTES),
            kind: 'source',
            kindSource: 'policy',
            tags: [],
            executable: false,
            size: bytes.length,
        });
    }
    const automatic = detectConfigurations(repository.files, manifests, [])
        .filter(
            ({ configuration, kind }) =>
                kind === 'general' &&
                (manifests.get(configuration)?.configuration.when?.git !== true || repository.hasGit),
        )
        .map(({ configuration }) => configuration);
    const scopes = scopeSelections(
        { ...policy, configurations: [...new Set([...policy.configurations, ...automatic])] },
        repository.scopes,
        manifests,
    );
    let resolved: PackageInstaller | undefined;
    let resolvedPython: Promise<string> | undefined;
    const session: Session = {
        pythonInstaller: () => (resolvedPython ??= acquirePythonInstaller(root, policyFiles.policy.run_with)),
        packageInstaller() {
            if (installer === undefined) return undefined;
            resolved ??= inspectPackageInstaller(root, installer);
            return resolved;
        },
        root,
        version: RUNNING_VERSION,
        policyFiles,
        manifests,
        repository,
        scopes,
        inspections: new Map(),
        getPendingInstallations: (path) => getOwnership(path).installing,
        reads: { root, sources: new Map(), memo: new Map() },
    };
    const runner = policyFiles.policy.run_with;
    const needsPackages = Object.keys(npmPins(applicableManifests(session), runner)).length > 0;
    const installer: PackageInstallerIdentity | undefined = needsPackages
        ? await selectPackageInstaller(
              root,
              repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
          )
        : undefined;
    return session;
}
