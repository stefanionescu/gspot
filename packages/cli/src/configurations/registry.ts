import type { Check } from '#cli/types/manifests.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { TSC_CHECKS } from '#cli/configurations/tsc/check.ts';
import { HTML_CHECKS } from '#cli/configurations/language/html/checks.ts';
import { EXPO_CHECKS } from '#cli/configurations/framework/expo/checks.ts';
import { PROSE_CHECKS } from '#cli/configurations/general/prose/checks.ts';
import { PYTEST_CHECKS } from '#cli/configurations/testing/pytest/checks.ts';
import { NEXTJS_CHECKS } from '#cli/configurations/framework/nextjs/checks.ts';
import { SVELTE_CHECKS } from '#cli/configurations/framework/svelte/checks.ts';
import { COMMITS_CHECKS } from '#cli/configurations/general/commits/checks.ts';
import { SECRETS_CHECKS } from '#cli/configurations/general/secrets/checks.ts';
import { GENERATOR_OUTPUT_RULE_DOCS } from '#cli/configurations/explanations.ts';
import { LICENSES_CHECKS } from '#cli/configurations/general/licenses/checks.ts';
import { SECURITY_CHECKS } from '#cli/configurations/general/security/checks.ts';
import { checkGeneratorOutputs } from '#cli/configurations/generator-outputs.ts';
import { NGINX_CHECKS } from '#cli/configurations/infrastructure/nginx/checks.ts';
import { XCODE_CHECKS } from '#cli/configurations/infrastructure/xcode/checks.ts';
import { MARKDOWN_CHECKS } from '#cli/configurations/language/markdown/checks.ts';
import { SUPABASE_CHECKS } from '#cli/configurations/platform/supabase/checks.ts';
import { REACT_DOM_CHECKS } from '#cli/configurations/framework/react-dom/checks.ts';
import { DATA_FILES_CHECKS } from '#cli/configurations/general/data-files/checks.ts';
import { REPOSITORY_CHECKS } from '#cli/configurations/general/repository/checks.ts';
import { ANSIBLE_CHECKS } from '#cli/configurations/infrastructure/ansible/checks.ts';
import { JAVASCRIPT_CHECKS } from '#cli/configurations/language/javascript/checks.ts';
import { TYPESCRIPT_CHECKS } from '#cli/configurations/language/typescript/checks.ts';
import { CLOUDFLARE_CHECKS } from '#cli/configurations/platform/cloudflare/checks.ts';
import { SITE_BUILD_CHECKS } from '#cli/configurations/framework/site/checks/build.ts';
import { SITE_PAGES_CHECKS } from '#cli/configurations/framework/site/checks/pages.ts';
import { ENGINEERING_CHECKS } from '#cli/configurations/general/engineering/checks.ts';
import { BASH_SAFETY_CHECKS } from '#cli/configurations/language/bash/checks/safety.ts';
import { SWIFT_BUILD_CHECKS } from '#cli/configurations/language/swift/checks/build.ts';
import { DEPENDENCIES_CHECKS } from '#cli/configurations/general/dependencies/checks.ts';
import { NAMING_PATHS_CHECKS } from '#cli/configurations/general/naming/checks/paths.ts';
import { TRANSLATIONS_CHECKS } from '#cli/configurations/library/translations/checks.ts';
import { PYTHON_DEPTRY_CHECKS } from '#cli/configurations/language/python/checks/deptry.ts';
import { GSPOT_BASELINE_CHECKS } from '#cli/configurations/general/gspot/checks/baseline.ts';
import { PYTHON_VULTURE_CHECKS } from '#cli/configurations/language/python/checks/vulture.ts';
import { SWIFT_COVERAGE_CHECKS } from '#cli/configurations/language/swift/checks/coverage.ts';
import { SWIFT_SECURITY_CHECKS } from '#cli/configurations/language/swift/checks/security.ts';
import { STRUCTURE_JSCPD_CHECKS } from '#cli/configurations/general/structure/checks/jscpd.ts';
import { POSTGRES_GRANTS_CHECKS } from '#cli/configurations/database/postgres/checks/grants.ts';
import { BASH_SHELLCHECK_CHECKS } from '#cli/configurations/language/bash/checks/shellcheck.ts';
import { SWIFT_PERIPHERY_CHECKS } from '#cli/configurations/language/swift/checks/periphery.ts';
import { SWIFT_SWIFTLINT_CHECKS } from '#cli/configurations/language/swift/checks/swiftlint.ts';
import { GSPOT_WEAKENINGS_CHECKS } from '#cli/configurations/general/gspot/checks/weakenings.ts';
import { PYTHON_PYDOCLINT_CHECKS } from '#cli/configurations/language/python/checks/pydoclint.ts';
import { DOCKER_COMPOSE_CHECKS } from '#cli/configurations/infrastructure/docker/checks/compose.ts';
import { GITHUB_ACTIONS_CHECKS } from '#cli/configurations/infrastructure/github-actions/checks.ts';
import { BASH_DOC_COMMENTS_CHECKS } from '#cli/configurations/language/bash/checks/doc-comments.ts';
import { DOCS_MISSING_PATHS_CHECKS } from '#cli/configurations/general/docs/checks/missing-paths.ts';
import { GSPOT_SUPPRESSIONS_CHECKS } from '#cli/configurations/general/gspot/checks/suppressions.ts';
import { NAMING_IDENTIFIERS_CHECKS } from '#cli/configurations/general/naming/checks/identifiers.ts';
import { BASH_FUNCTION_SIZE_CHECKS } from '#cli/configurations/language/bash/checks/function-size.ts';
import { BASH_SCRIPT_LAYOUT_CHECKS } from '#cli/configurations/language/bash/checks/script-layout.ts';
import { SWIFT_DOC_COMMENTS_CHECKS } from '#cli/configurations/language/swift/checks/doc-comments.ts';
import { SWIFT_SKIP_REASONS_CHECKS } from '#cli/configurations/language/swift/checks/skip-reasons.ts';
import { SITE_UNUSED_ASSETS_CHECKS } from '#cli/configurations/framework/site/checks/unused-assets.ts';
import { DOCS_REQUIRED_FILES_CHECKS } from '#cli/configurations/general/docs/checks/required-files.ts';
import { BASH_INLINE_SCRIPTS_CHECKS } from '#cli/configurations/language/bash/checks/inline-scripts.ts';
import { PYTHON_PIP_INSTALLS_CHECKS } from '#cli/configurations/language/python/checks/pip-installs.ts';
import { DOCS_VERSION_STRINGS_CHECKS } from '#cli/configurations/general/docs/checks/version-strings.ts';
import { NAMING_ALLOWED_NAMES_CHECKS } from '#cli/configurations/general/naming/checks/allowed-names.ts';
import { STRUCTURE_LONE_FILES_CHECKS } from '#cli/configurations/general/structure/checks/lone-files.ts';
import { STRUCTURE_LONG_FILES_CHECKS } from '#cli/configurations/general/structure/checks/long-files.ts';
import { PYTHON_FUNCTION_SIZE_CHECKS } from '#cli/configurations/language/python/checks/function-size.ts';
import { GSPOT_GENERATED_FILES_CHECKS } from '#cli/configurations/general/gspot/checks/generated-files.ts';
import { GSPOT_UNMATCHED_PATHS_CHECKS } from '#cli/configurations/general/gspot/checks/unmatched-paths.ts';
import { STRUCTURE_BARE_BLOCKS_CHECKS } from '#cli/configurations/general/structure/checks/bare-blocks.ts';
import { DOCKER_TRIVY_IMAGE_CHECKS } from '#cli/configurations/infrastructure/docker/checks/trivy-image.ts';
import { BASH_UNREAD_ARGUMENTS_CHECKS } from '#cli/configurations/language/bash/checks/unread-arguments.ts';
import { BASH_UNUSED_FUNCTIONS_CHECKS } from '#cli/configurations/language/bash/checks/unused-functions.ts';
import { STRUCTURE_IMPORT_RULES_CHECKS } from '#cli/configurations/general/structure/checks/import-rules.ts';
import { DOCKER_DOCKERIGNORE_CHECKS } from '#cli/configurations/infrastructure/docker/checks/dockerignore.ts';
import { DOCKER_INSTRUCTIONS_CHECKS } from '#cli/configurations/infrastructure/docker/checks/instructions.ts';
import { ROW_LEVEL_SECURITY_CHECKS } from '#cli/configurations/database/postgres/checks/row-level-security.ts';
import { DEFINER_SEARCH_PATH_CHECKS } from '#cli/configurations/database/postgres/checks/definer-search-path.ts';
import { FOREIGN_KEY_INDEXES_CHECKS } from '#cli/configurations/database/postgres/checks/foreign-key-indexes.ts';
import { ENVIRONMENT_READERS_CHECKS } from '#cli/configurations/general/structure/checks/environment-readers.ts';
import { FILE_FOLDER_CLASHES_CHECKS } from '#cli/configurations/general/structure/checks/file-folder-clashes.ts';
import { STRUCTURE_FUNCTION_ORDER_CHECKS } from '#cli/configurations/general/structure/checks/function-order.ts';
import { POSTGRES_MIGRATION_ORDER_CHECKS } from '#cli/configurations/database/postgres/checks/migration-order.ts';
import { GSPOT_CONFLICTING_CONFIGS_CHECKS } from '#cli/configurations/general/gspot/checks/conflicting-configs.ts';
import { PASS_THROUGH_FOLDERS_CHECKS } from '#cli/configurations/general/structure/checks/pass-through-folders.ts';
import { STRUCTURE_SHARED_PREFIXES_CHECKS } from '#cli/configurations/general/structure/checks/shared-prefixes.ts';
import { DETECTED_CONFIGURATIONS_CHECKS } from '#cli/configurations/general/gspot/checks/detected-configurations.ts';
import { PLACEHOLDER_DOCSTRINGS_CHECKS } from '#cli/configurations/language/python/checks/placeholder-docstrings.ts';
import { POSTGRES_EDITED_MIGRATIONS_CHECKS } from '#cli/configurations/database/postgres/checks/edited-migrations.ts';
import { STRUCTURE_TRIVIAL_FUNCTIONS_CHECKS } from '#cli/configurations/general/structure/checks/trivial-functions.ts';

export const CHECK_CODE: Readonly<Record<string, CheckCode>> = {
    ...ANSIBLE_CHECKS,
    ...BASH_DOC_COMMENTS_CHECKS,
    ...BASH_FUNCTION_SIZE_CHECKS,
    ...BASH_INLINE_SCRIPTS_CHECKS,
    ...BASH_SAFETY_CHECKS,
    ...BASH_SCRIPT_LAYOUT_CHECKS,
    ...BASH_SHELLCHECK_CHECKS,
    ...BASH_UNREAD_ARGUMENTS_CHECKS,
    ...BASH_UNUSED_FUNCTIONS_CHECKS,
    ...CLOUDFLARE_CHECKS,
    ...COMMITS_CHECKS,
    ...DATA_FILES_CHECKS,
    ...DEPENDENCIES_CHECKS,
    ...DOCKER_COMPOSE_CHECKS,
    ...DOCKER_DOCKERIGNORE_CHECKS,
    ...DOCKER_INSTRUCTIONS_CHECKS,
    ...DOCKER_TRIVY_IMAGE_CHECKS,
    ...DOCS_MISSING_PATHS_CHECKS,
    ...DOCS_REQUIRED_FILES_CHECKS,
    ...DOCS_VERSION_STRINGS_CHECKS,
    ...ENGINEERING_CHECKS,
    ...EXPO_CHECKS,
    ...GITHUB_ACTIONS_CHECKS,
    ...GSPOT_BASELINE_CHECKS,
    ...GSPOT_CONFLICTING_CONFIGS_CHECKS,
    ...DETECTED_CONFIGURATIONS_CHECKS,
    ...GSPOT_GENERATED_FILES_CHECKS,
    ...GSPOT_SUPPRESSIONS_CHECKS,
    ...GSPOT_UNMATCHED_PATHS_CHECKS,
    ...GSPOT_WEAKENINGS_CHECKS,
    ...HTML_CHECKS,
    ...JAVASCRIPT_CHECKS,
    ...LICENSES_CHECKS,
    ...MARKDOWN_CHECKS,
    ...NAMING_ALLOWED_NAMES_CHECKS,
    ...NAMING_IDENTIFIERS_CHECKS,
    ...NAMING_PATHS_CHECKS,
    ...NEXTJS_CHECKS,
    ...NGINX_CHECKS,
    ...DEFINER_SEARCH_PATH_CHECKS,
    ...POSTGRES_EDITED_MIGRATIONS_CHECKS,
    ...FOREIGN_KEY_INDEXES_CHECKS,
    ...POSTGRES_GRANTS_CHECKS,
    ...POSTGRES_MIGRATION_ORDER_CHECKS,
    ...ROW_LEVEL_SECURITY_CHECKS,
    ...PROSE_CHECKS,
    ...PYTEST_CHECKS,
    ...PYTHON_DEPTRY_CHECKS,
    ...PYTHON_FUNCTION_SIZE_CHECKS,
    ...PYTHON_PIP_INSTALLS_CHECKS,
    ...PLACEHOLDER_DOCSTRINGS_CHECKS,
    ...PYTHON_PYDOCLINT_CHECKS,
    ...PYTHON_VULTURE_CHECKS,
    ...REACT_DOM_CHECKS,
    ...REPOSITORY_CHECKS,
    ...SECRETS_CHECKS,
    ...SECURITY_CHECKS,
    ...SITE_BUILD_CHECKS,
    ...SITE_PAGES_CHECKS,
    ...SITE_UNUSED_ASSETS_CHECKS,
    ...STRUCTURE_BARE_BLOCKS_CHECKS,
    ...ENVIRONMENT_READERS_CHECKS,
    ...FILE_FOLDER_CLASHES_CHECKS,
    ...STRUCTURE_FUNCTION_ORDER_CHECKS,
    ...STRUCTURE_IMPORT_RULES_CHECKS,
    ...STRUCTURE_JSCPD_CHECKS,
    ...STRUCTURE_LONE_FILES_CHECKS,
    ...STRUCTURE_LONG_FILES_CHECKS,
    ...PASS_THROUGH_FOLDERS_CHECKS,
    ...STRUCTURE_SHARED_PREFIXES_CHECKS,
    ...STRUCTURE_TRIVIAL_FUNCTIONS_CHECKS,
    ...SUPABASE_CHECKS,
    ...SVELTE_CHECKS,
    ...SWIFT_BUILD_CHECKS,
    ...SWIFT_COVERAGE_CHECKS,
    ...SWIFT_DOC_COMMENTS_CHECKS,
    ...SWIFT_PERIPHERY_CHECKS,
    ...SWIFT_SECURITY_CHECKS,
    ...SWIFT_SKIP_REASONS_CHECKS,
    ...SWIFT_SWIFTLINT_CHECKS,
    ...TRANSLATIONS_CHECKS,
    ...TSC_CHECKS,
    ...TYPESCRIPT_CHECKS,
    ...XCODE_CHECKS,
};

/**
Find the implementation of a built-in check or a check that compares generator outputs.

@param check the manifest check.
*/
export function selectCheckCode(check: Check): CheckCode | undefined {
    if (check.generator_outputs !== undefined)
        return { check: checkGeneratorOutputs, ruleDocs: GENERATOR_OUTPUT_RULE_DOCS };
    return CHECK_CODE[check.id];
}
