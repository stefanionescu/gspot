import { SQL_ANALYSES } from '#cli/checks/sql.ts';
import type { Engine } from '#cli/types/checks.ts';
import type { CheckSpec } from '#cli/types/kits.ts';
import { HTML_ANALYSES } from '#cli/checks/html.ts';
import { cssModuleUsage } from '#cli/checks/css.ts';
import { svelteCheck } from '#cli/checks/svelte.ts';
import { ansibleLint } from '#cli/checks/ansible.ts';
import { localeFiles } from '#cli/checks/locales.ts';
import { trpcBoundaries } from '#cli/checks/trpc.ts';
import { jestCoverage } from '#cli/checks/jest/run.ts';
import { expoDoctor } from '#cli/checks/react-native.ts';
import { DRIZZLE_ANALYSES } from '#cli/checks/drizzle.ts';
import { DOCS_ANALYSES } from '#cli/checks/docs/analyses.ts';
import { nginxTest } from '#cli/checks/nginx/config-test.ts';
import { SWIFT_ANALYSES } from '#cli/checks/swift/analyses.ts';
import { XCODE_ANALYSES } from '#cli/checks/xcode/analyses.ts';
import { CLOUDFLARE_ANALYSES } from '#cli/checks/cloudflare.ts';
import { DOCKER_ANALYSES } from '#cli/checks/docker/analyses.ts';
import { NEXTJS_ANALYSES } from '#cli/checks/nextjs/analyses.ts';
import { PYTHON_ANALYSES } from '#cli/checks/python/analyses.ts';
import { XCTEST_ANALYSES } from '#cli/checks/xctest/analyses.ts';
import { EXPRESS_ANALYSES } from '#cli/checks/express/analyses.ts';
import { OPENAPI_ANALYSES } from '#cli/checks/openapi/analyses.ts';
import { POSTGRES_ANALYSES } from '#cli/checks/postgres/analyses.ts';
import { SECURITY_ANALYSES } from '#cli/checks/security/analyses.ts';
import { SUPABASE_ANALYSES } from '#cli/checks/supabase/analyses.ts';
import { REPOSITORY_ANALYSES } from '#cli/checks/repository/analyses.ts';
import { TYPESCRIPT_ANALYSES } from '#cli/checks/typescript/analyses.ts';
import { STATIC_SITE_ANALYSES } from '#cli/checks/static-site/analyses.ts';
import { DEPENDENCIES_ANALYSES } from '#cli/checks/dependencies/analyses.ts';

// Every integrity analysis: the family registries, then the checks that stand alone.
const checks: Record<string, Engine> = {
    'trpc-boundaries': trpcBoundaries,
    'expo-doctor': expoDoctor,
    'svelte-check': svelteCheck,
    'locale-files': localeFiles,
    'css-module-usage': cssModuleUsage,
    'ansible-lint': ansibleLint,
    'nginx-test': nginxTest,
    'jest-coverage': jestCoverage,
    ...REPOSITORY_ANALYSES,
    ...TYPESCRIPT_ANALYSES,
    ...DOCS_ANALYSES,
    ...SECURITY_ANALYSES,
    ...DEPENDENCIES_ANALYSES,
    ...DRIZZLE_ANALYSES,
    ...NEXTJS_ANALYSES,
    ...CLOUDFLARE_ANALYSES,
    ...STATIC_SITE_ANALYSES,
    ...HTML_ANALYSES,
    ...PYTHON_ANALYSES,
    ...XCTEST_ANALYSES,
    ...XCODE_ANALYSES,
    ...SWIFT_ANALYSES,
    ...EXPRESS_ANALYSES,
    ...OPENAPI_ANALYSES,
    ...SUPABASE_ANALYSES,
    ...POSTGRES_ANALYSES,
    ...SQL_ANALYSES,
    ...DOCKER_ANALYSES,
};
/**
 * Resolve the declared integrity analysis before executing any checks.
 * @param spec the check
 * @returns the engine that runs the analysis
 */
export function integrityEngine(spec: CheckSpec): Engine {
    const name = spec.analysis ?? spec.name.slice(spec.name.indexOf('/') + 1);
    const check = checks[name];
    if (!check) throw new Error(`No integrity analysis is called ${name}.`);
    return check;
}
