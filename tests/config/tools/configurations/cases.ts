import { BASH_CASES } from '#tests/config/samples/bash.ts';
import * as postgres from '#tests/config/tools/configurations/postgres.ts';
import * as supabase from '#tests/config/tools/configurations/supabase.ts';
import * as libraries from '#tests/config/tools/configurations/libraries.ts';
import * as react from '#tests/config/tools/configurations/framework/react.ts';
import * as toolDocker from '#tests/config/tools/configurations/tool/docker.ts';
import * as toolVitest from '#tests/config/tools/configurations/tool/vitest.ts';
import * as generalSite from '#tests/config/tools/configurations/general/site.ts';
import * as languageSql from '#tests/config/tools/configurations/language/sql.ts';
import * as toolActions from '#tests/config/tools/configurations/tool/actions.ts';
import * as toolOpenapi from '#tests/config/tools/configurations/tool/openapi.ts';
import * as frameworkVue from '#tests/config/tools/configurations/framework/vue.ts';
import * as generalFiles from '#tests/config/tools/configurations/general/files.ts';
import * as languageHtml from '#tests/config/tools/configurations/language/html.ts';
import type { BashBoundary, ConfigurationScenario } from '#tests/types/tools/cases.ts';
import * as languagePython from '#tests/config/tools/configurations/language/python.ts';
import * as frameworkNestjs from '#tests/config/tools/configurations/framework/nestjs.ts';
import * as frameworkNextjs from '#tests/config/tools/configurations/framework/nextjs.ts';
import * as frameworkSvelte from '#tests/config/tools/configurations/framework/svelte.ts';
import * as languageBashChecks from '#tests/config/tools/configurations/language/bash/checks.ts';
import * as languageSwiftChecks from '#tests/config/tools/configurations/language/swift/checks.ts';
import * as languageSwiftPackage from '#tests/config/tools/configurations/language/swift/package.ts';
import * as markdownDocsProse from '#tests/config/tools/configurations/general/markdown-docs-prose.ts';
import * as languageTypescriptChecks from '#tests/config/tools/configurations/language/typescript/checks.ts';
import * as generalSecretsEnvironment from '#tests/config/tools/configurations/general/secrets/environment.ts';
/** Literal scenario names, authored repositories, and finding tables. */
export const SCENARIOS: ConfigurationScenario[] = [
    { name: 'the library configurations', repository: libraries.REPOSITORY, cases: libraries.CASES },
    { name: 'the postgres configuration', repository: postgres.REPOSITORY, cases: postgres.CASES },
    { name: 'the supabase configuration', repository: supabase.REPOSITORY, cases: supabase.CASES },
    { name: 'the actions configuration', repository: toolActions.REPOSITORY, cases: toolActions.CASES },
    { name: 'the docker configuration', repository: toolDocker.REPOSITORY, cases: toolDocker.CASES },
    { name: 'the openapi configuration', repository: toolOpenapi.REPOSITORY, cases: toolOpenapi.CASES },
    { name: 'the vitest configuration', repository: toolVitest.REPOSITORY, cases: toolVitest.CASES },
    { name: 'the html configuration', repository: languageHtml.REPOSITORY, cases: languageHtml.CASES },
    { name: 'the python configuration', repository: languagePython.REPOSITORY, cases: languagePython.CASES },
    { name: 'the sql configuration', repository: languageSql.REPOSITORY, cases: languageSql.CASES },
    {
        name: 'the typescript configuration',
        repository: languageTypescriptChecks.REPOSITORY,
        cases: languageTypescriptChecks.CASES,
    },
    { name: 'the swift configuration', repository: languageSwiftChecks.REPOSITORY, cases: languageSwiftChecks.CASES },
    {
        name: 'the swift configuration over a package',
        repository: languageSwiftPackage.REPOSITORY,
        cases: languageSwiftPackage.CASES,
        platforms: ['darwin'],
    },
    { name: 'the bash configuration', repository: languageBashChecks.REPOSITORY, cases: BASH_CASES },
    { name: 'the files configuration', repository: generalFiles.REPOSITORY, cases: generalFiles.CASES },
    {
        name: 'the markdown, docs and prose configurations',
        repository: markdownDocsProse.REPOSITORY,
        cases: markdownDocsProse.CASES,
    },
    { name: 'the site configuration', repository: generalSite.REPOSITORY, cases: generalSite.CASES },
    {
        name: 'environment checks in the secrets configuration',
        repository: generalSecretsEnvironment.REPOSITORY,
        cases: generalSecretsEnvironment.CASES,
    },
    { name: 'the nestjs configuration', repository: frameworkNestjs.REPOSITORY, cases: frameworkNestjs.CASES },
    { name: 'the nextjs configuration', repository: frameworkNextjs.REPOSITORY, cases: frameworkNextjs.CASES },
    { name: 'the react configuration', repository: react.REPOSITORY, cases: react.CASES },
    { name: 'the expo configuration', repository: react.EXPO_REPOSITORY, cases: react.EXPO_CASES },
    { name: 'the bare react-native configuration', repository: react.NATIVE_REPOSITORY, cases: react.NATIVE_CASES },
    { name: 'the svelte configuration', repository: frameworkSvelte.REPOSITORY, cases: frameworkSvelte.CASES },
    { name: 'the vue configuration', repository: frameworkVue.REPOSITORY, cases: frameworkVue.CASES },
];

/** Source locations for the generated Bash size samples. */
export const BASH_LOCATIONS = [
    { file: 'scripts/long.sh', rule: 'file-lines', line: 1 },
    { file: 'scripts/tall.sh', rule: 'function-lines', line: 9 },
    { file: 'scripts/branchy.sh', rule: 'branches', line: 9 },
    { file: 'scripts/deep.sh', rule: 'nesting', line: 9 },
    { file: 'scripts/mutable.sh', rule: 'assignments', line: 9 },
] as const satisfies readonly BashBoundary['expected'][];
