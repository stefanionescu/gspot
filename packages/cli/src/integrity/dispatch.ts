// The integrity engine: one function per check, chosen by `analysis =` in the manifest.
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { codeql } from '#cli/integrity/codeql.ts';
import { fences } from '#cli/integrity/fences.ts';
import { adminKey } from '#cli/supabase/admin-key.ts';
import { routesTested } from '#cli/express/routes.ts';
import { envFiles } from '#cli/integrity/env/files.ts';
import { licensesNpm } from '#cli/integrity/licenses.ts';
import type { IntegrityCheck } from '#types/integrity.ts';
import { typesFresh } from '#cli/supabase/types-fresh.ts';
import { envExample } from '#cli/integrity/env/example.ts';
import { largeFiles } from '#cli/integrity/large-files.ts';
import { stalePaths } from '#cli/integrity/stale-paths.ts';
import { taskPolicy } from '#cli/integrity/task-policy.ts';
import { denoCheck, denoLint } from '#cli/supabase/deno.ts';
import { ansibleLint } from '#cli/integrity/ansible-lint.ts';
import { readmeShape } from '#cli/integrity/readme/shape.ts';
import { suppressions } from '#cli/integrity/suppressions.ts';
import { docsHeadings } from '#cli/integrity/docs-headings.ts';
import { migrationDocs } from '#cli/postgres/migration-docs.ts';
import { nginxTest } from '#cli/integrity/nginx/config-test.ts';
import { installPolicy } from '#cli/integrity/install-policy.ts';
import { lockfileFresh } from '#cli/integrity/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/integrity/lockfile/hosts.ts';
import { readmePresent } from '#cli/integrity/readme/present.ts';
import { trivyImage } from '#cli/integrity/docker/image-scan.ts';
import { generatedDrift } from '#cli/integrity/generated-drift.ts';
import { manifestPolicy } from '#cli/integrity/manifest-policy.ts';
import { dockerignore } from '#cli/integrity/docker/ignore-file.ts';
import { openapiFresh, openapiLint } from '#cli/express/openapi.ts';
import { allowlistsMatch } from '#cli/integrity/allowlists-match.ts';
import { tsconfigOptions } from '#cli/integrity/tsconfig-options.ts';
import { configurationPurity } from '#cli/integrity/config-purity.ts';
import { baselinesCurrent } from '#cli/integrity/baselines-current.ts';
import { gitleaksBaseline } from '#cli/integrity/gitleaks-baseline.ts';
import { migrationOrder, migrationsFrozen } from '#cli/postgres/history.ts';
import { trackedDependencies } from '#cli/integrity/tracked-dependencies.ts';
import { swiftAnalyze, swiftBuild, swiftPeriphery } from '#cli/apple/build.ts';
import { sqlBlockComments, sqlFileLength, sqlSyntax } from '#cli/sql/checks.ts';
import { projectValid, migrationNames, storagePolicies } from '#cli/supabase/config-checks.ts';
import { definerSearchPath, explicitGrants, foreignKeyIndexes, rlsPresent } from '#cli/postgres/schema/checks.ts';

const checks: Record<string, IntegrityCheck> = {
    'generated-drift': generatedDrift,
    'tsconfig-options': tsconfigOptions,
    'docs-headings': docsHeadings,
    'stale-paths': stalePaths,
    'readme-present': readmePresent,
    'readme-shape': readmeShape,
    fences,
    'env-example': envExample,
    'baselines-current': baselinesCurrent,
    'config-purity': configurationPurity,
    suppressions,
    'allowlists-match': allowlistsMatch,
    'task-policy': taskPolicy,
    'large-files': largeFiles,
    'tracked-dependencies': trackedDependencies,
    'env-files': envFiles,
    'manifest-policy': manifestPolicy,
    'lockfile-fresh': lockfileFresh,
    'licenses-npm': licensesNpm,
    'swift-build': swiftBuild,
    'swift-analyze': swiftAnalyze,
    'swift-periphery': swiftPeriphery,
    'ansible-lint': ansibleLint,
    'openapi-lint': openapiLint,
    'openapi-fresh': openapiFresh,
    'routes-tested': routesTested,
    'supabase-config': projectValid,
    'supabase-storage': storagePolicies,
    'supabase-migration-names': migrationNames,
    'supabase-deno-lint': denoLint,
    'supabase-deno-check': denoCheck,
    'supabase-admin-key': adminKey,
    'supabase-types': typesFresh,
    'postgres-rls': rlsPresent,
    'postgres-grants': explicitGrants,
    'postgres-definer': definerSearchPath,
    'postgres-foreign-keys': foreignKeyIndexes,
    'postgres-order': migrationOrder,
    'postgres-frozen': migrationsFrozen,
    'postgres-docs': migrationDocs,
    'sql-syntax': sqlSyntax,
    'sql-block-comments': sqlBlockComments,
    'sql-file-length': sqlFileLength,
    'nginx-test': nginxTest,
    dockerignore,
    'trivy-image': trivyImage,
    'install-policy': installPolicy,
    'lockfile-hosts': lockfileHosts,
    codeql,
    'gitleaks-baseline': gitleaksBaseline,
};

/**
 * Runs the analysis a check names.
 * @param input the engine input
 * @returns the findings
 */
export async function runIntegrity(input: EngineInput): Promise<Finding[]> {
    const name = input.spec.analysis ?? input.spec.id.slice(input.spec.id.indexOf('/') + 1);
    const check = checks[name];
    if (!check) throw new Error(`No integrity analysis is called ${name}.`);
    return check(input);
}
