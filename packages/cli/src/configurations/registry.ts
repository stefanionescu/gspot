import { joinTables } from '#cli/system/tables.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { TSC_CHECKS } from '#cli/configurations/tsc/check.ts';
import { JEST_CHECKS } from '#cli/configurations/testing/jest/checks.ts';
import type { ConfigBuilder } from '#cli/types/configurations/shared.ts';
import { HTML_CHECKS } from '#cli/configurations/language/html/checks.ts';
import { YAML_CHECKS } from '#cli/configurations/language/yaml/checks.ts';
import { EXPO_CHECKS } from '#cli/configurations/framework/expo/checks.ts';
import { PROSE_CHECKS } from '#cli/configurations/general/prose/checks.ts';
import { AGENTS_CHECKS } from '#cli/configurations/general/agents/checks.ts';
import { PYTEST_CHECKS } from '#cli/configurations/testing/pytest/checks.ts';
import { VITEST_CHECKS } from '#cli/configurations/testing/vitest/checks.ts';
import { NEXTJS_CHECKS } from '#cli/configurations/framework/nextjs/checks.ts';
import { SVELTE_CHECKS } from '#cli/configurations/framework/svelte/checks.ts';
import { COMMITS_CHECKS } from '#cli/configurations/general/commits/checks.ts';
import { SECRETS_CHECKS } from '#cli/configurations/general/secrets/checks.ts';
import { LICENSES_CHECKS } from '#cli/configurations/general/licenses/checks.ts';
import { SECURITY_CHECKS } from '#cli/configurations/general/security/checks.ts';
import { NGINX_CHECKS } from '#cli/configurations/infrastructure/nginx/checks.ts';
import { XCODE_CHECKS } from '#cli/configurations/infrastructure/xcode/checks.ts';
import { MARKDOWN_CHECKS } from '#cli/configurations/language/markdown/checks.ts';
import { SUPABASE_CHECKS } from '#cli/configurations/platform/supabase/checks.ts';
import { CSS_CONFIG_BUILDERS } from '#cli/configurations/language/css/generate.ts';
import { SQL_CONFIG_BUILDERS } from '#cli/configurations/language/sql/generate.ts';
import { DOCS_CONFIG_BUILDERS } from '#cli/configurations/general/docs/generate.ts';
import { REACT_DOM_CHECKS } from '#cli/configurations/framework/react-dom/checks.ts';
import { REPOSITORY_CHECKS } from '#cli/configurations/general/repository/checks.ts';
import { BASH_CONFIG_BUILDERS } from '#cli/configurations/language/bash/generate.ts';
import { HTML_CONFIG_BUILDERS } from '#cli/configurations/language/html/generate.ts';
import { JSON_CONFIG_BUILDERS } from '#cli/configurations/language/json/generate.ts';
import { TOML_CONFIG_BUILDERS } from '#cli/configurations/language/toml/generate.ts';
import { SITE_CONFIG_BUILDERS } from '#cli/configurations/framework/site/generate.ts';
import { PROSE_CONFIG_BUILDERS } from '#cli/configurations/general/prose/generate.ts';
import { ANSIBLE_CHECKS } from '#cli/configurations/infrastructure/ansible/checks.ts';
import { JAVASCRIPT_CHECKS } from '#cli/configurations/language/javascript/checks.ts';
import { TYPESCRIPT_CHECKS } from '#cli/configurations/language/typescript/checks.ts';
import { CLOUDFLARE_CHECKS } from '#cli/configurations/platform/cloudflare/checks.ts';
import { SITE_BUILD_CHECKS } from '#cli/configurations/framework/site/checks/build.ts';
import { KNIP_CONFIG_BUILDERS } from '#cli/configurations/language/javascript/knip.ts';
import { FORMAT_CONFIG_BUILDERS } from '#cli/configurations/general/format/generate.ts';
import { BASH_SAFETY_CHECKS } from '#cli/configurations/language/bash/checks/safety.ts';
import { SWIFT_BUILD_CHECKS } from '#cli/configurations/language/swift/checks/build.ts';
import { SWIFT_TESTS_CHECKS } from '#cli/configurations/language/swift/checks/tests.ts';
import { PYTEST_CONFIG_BUILDERS } from '#cli/configurations/testing/pytest/generate.ts';
import { SITE_LYCHEE_CHECKS } from '#cli/configurations/framework/site/checks/lychee.ts';
import { DEPENDENCIES_CHECKS } from '#cli/configurations/general/dependencies/checks.ts';
import { NAMING_PATHS_CHECKS } from '#cli/configurations/general/naming/checks/paths.ts';
import { BIOME_CONFIG_BUILDERS } from '#cli/configurations/language/javascript/biome.ts';
import { PYTHON_CONFIG_BUILDERS } from '#cli/configurations/language/python/generate.ts';
import { TRANSLATIONS_CHECKS } from '#cli/configurations/library/translations/checks.ts';
import { COMMITS_CONFIG_BUILDERS } from '#cli/configurations/general/commits/generate.ts';
import { SITE_SITEMAP_CHECKS } from '#cli/configurations/framework/site/checks/sitemap.ts';
import { SPELLING_CONFIG_BUILDERS } from '#cli/configurations/general/spelling/generate.ts';
import { PYTHON_DEPTRY_CHECKS } from '#cli/configurations/language/python/checks/deptry.ts';
import { PERIPHERY_CONFIG_BUILDERS } from '#cli/configurations/language/swift/periphery.ts';
import { SWIFTLINT_CONFIG_BUILDERS } from '#cli/configurations/language/swift/swiftlint.ts';
import { POSTGRES_CONFIG_BUILDERS } from '#cli/configurations/database/postgres/generate.ts';
import { SITE_PURGECSS_CHECKS } from '#cli/configurations/framework/site/checks/purgecss.ts';
import { NGINX_CONFIG_BUILDERS } from '#cli/configurations/infrastructure/nginx/generate.ts';
import { MARKDOWN_CONFIG_BUILDERS } from '#cli/configurations/language/markdown/generate.ts';
import { STRUCTURE_CONFIG_BUILDERS } from '#cli/configurations/general/structure/generate.ts';
import { PYTHON_VULTURE_CHECKS } from '#cli/configurations/language/python/checks/vulture.ts';
import { SWIFT_SECURITY_CHECKS } from '#cli/configurations/language/swift/checks/security.ts';
import { STRUCTURE_JSCPD_CHECKS } from '#cli/configurations/general/structure/checks/jscpd.ts';
import { DOCKER_CONFIG_BUILDERS } from '#cli/configurations/infrastructure/docker/generate.ts';
import { JSCONFIG_CONFIG_BUILDERS } from '#cli/configurations/language/javascript/jsconfig.ts';
import { POSTGRES_GRANTS_CHECKS } from '#cli/configurations/database/postgres/checks/grants.ts';
import { BASH_SHELLCHECK_CHECKS } from '#cli/configurations/language/bash/checks/shellcheck.ts';
import { SWIFT_PERIPHERY_CHECKS } from '#cli/configurations/language/swift/checks/periphery.ts';
import { SWIFTFORMAT_CONFIG_BUILDERS } from '#cli/configurations/language/swift/swiftformat.ts';
import { GSPOT_WEAKENINGS_CHECKS } from '#cli/configurations/general/gspot/checks/weakenings.ts';
import { ANSIBLE_CONFIG_BUILDERS } from '#cli/configurations/infrastructure/ansible/generate.ts';
import { OPENAPI_CONFIG_BUILDERS } from '#cli/configurations/infrastructure/openapi/generate.ts';
import { PYTHON_PYDOCLINT_CHECKS } from '#cli/configurations/language/python/checks/pydoclint.ts';
import { DOCKER_COMPOSE_CHECKS } from '#cli/configurations/infrastructure/docker/checks/compose.ts';
import { GITHUB_ACTIONS_CHECKS } from '#cli/configurations/infrastructure/github-actions/checks.ts';
import { ESLINT_CONFIG_BUILDERS } from '#cli/configurations/language/javascript/eslint/generate.ts';
import { DOCS_MISSING_PATHS_CHECKS } from '#cli/configurations/general/docs/checks/missing-paths.ts';
import { GSPOT_SUPPRESSIONS_CHECKS } from '#cli/configurations/general/gspot/checks/suppressions.ts';
import { NAMING_IDENTIFIERS_CHECKS } from '#cli/configurations/general/naming/checks/identifiers.ts';
import { BASH_FUNCTION_SIZE_CHECKS } from '#cli/configurations/language/bash/checks/function-size.ts';
import { BASH_SCRIPT_LAYOUT_CHECKS } from '#cli/configurations/language/bash/checks/script-layout.ts';
import { SWIFT_SKIP_REASONS_CHECKS } from '#cli/configurations/language/swift/checks/skip-reasons.ts';
import { SITE_HTML_VALIDATE_CHECKS } from '#cli/configurations/framework/site/checks/html-validate.ts';
import { SITE_UNUSED_ASSETS_CHECKS } from '#cli/configurations/framework/site/checks/unused-assets.ts';
import { DEPENDENCIES_CONFIG_BUILDERS } from '#cli/configurations/general/dependencies/osv-scanner.ts';
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
import { STRUCTURE_EMPTY_FOLDERS_CHECKS } from '#cli/configurations/general/structure/checks/empty-folders.ts';
import { checkGeneratorOutputs, GENERATOR_OUTPUT_EXPLANATIONS } from '#cli/configurations/generator-outputs.ts';
import { SWIFT_SWIFTLINT_ANALYZE_CHECKS } from '#cli/configurations/language/swift/checks/swiftlint-analyze.ts';
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
import { DOCKER_SERVICE_SECURITY_CHECKS } from '#cli/configurations/infrastructure/docker/checks/service-security.ts';
import { STRUCTURE_TRIVIAL_FUNCTIONS_CHECKS } from '#cli/configurations/general/structure/checks/trivial-functions.ts';

export const CHECK_CODE = joinTables<CheckCode>([
    AGENTS_CHECKS,
    ANSIBLE_CHECKS,
    BASH_FUNCTION_SIZE_CHECKS,
    BASH_INLINE_SCRIPTS_CHECKS,
    BASH_SAFETY_CHECKS,
    BASH_SCRIPT_LAYOUT_CHECKS,
    BASH_SHELLCHECK_CHECKS,
    BASH_UNREAD_ARGUMENTS_CHECKS,
    BASH_UNUSED_FUNCTIONS_CHECKS,
    CLOUDFLARE_CHECKS,
    COMMITS_CHECKS,
    DEPENDENCIES_CHECKS,
    DOCKER_COMPOSE_CHECKS,
    DOCKER_DOCKERIGNORE_CHECKS,
    DOCKER_INSTRUCTIONS_CHECKS,
    DOCKER_SERVICE_SECURITY_CHECKS,
    DOCKER_TRIVY_IMAGE_CHECKS,
    DOCS_MISSING_PATHS_CHECKS,
    DOCS_REQUIRED_FILES_CHECKS,
    DOCS_VERSION_STRINGS_CHECKS,
    EXPO_CHECKS,
    GITHUB_ACTIONS_CHECKS,
    GSPOT_CONFLICTING_CONFIGS_CHECKS,
    DETECTED_CONFIGURATIONS_CHECKS,
    GSPOT_GENERATED_FILES_CHECKS,
    GSPOT_SUPPRESSIONS_CHECKS,
    GSPOT_UNMATCHED_PATHS_CHECKS,
    GSPOT_WEAKENINGS_CHECKS,
    HTML_CHECKS,
    JAVASCRIPT_CHECKS,
    JEST_CHECKS,
    LICENSES_CHECKS,
    MARKDOWN_CHECKS,
    NAMING_ALLOWED_NAMES_CHECKS,
    NAMING_IDENTIFIERS_CHECKS,
    NAMING_PATHS_CHECKS,
    NEXTJS_CHECKS,
    NGINX_CHECKS,
    DEFINER_SEARCH_PATH_CHECKS,
    POSTGRES_EDITED_MIGRATIONS_CHECKS,
    FOREIGN_KEY_INDEXES_CHECKS,
    POSTGRES_GRANTS_CHECKS,
    POSTGRES_MIGRATION_ORDER_CHECKS,
    ROW_LEVEL_SECURITY_CHECKS,
    PROSE_CHECKS,
    PYTEST_CHECKS,
    PYTHON_DEPTRY_CHECKS,
    PYTHON_FUNCTION_SIZE_CHECKS,
    PYTHON_PIP_INSTALLS_CHECKS,
    PLACEHOLDER_DOCSTRINGS_CHECKS,
    PYTHON_PYDOCLINT_CHECKS,
    PYTHON_VULTURE_CHECKS,
    REACT_DOM_CHECKS,
    REPOSITORY_CHECKS,
    SECRETS_CHECKS,
    SECURITY_CHECKS,
    SITE_BUILD_CHECKS,
    SITE_HTML_VALIDATE_CHECKS,
    SITE_LYCHEE_CHECKS,
    SITE_PURGECSS_CHECKS,
    SITE_SITEMAP_CHECKS,
    SITE_UNUSED_ASSETS_CHECKS,
    STRUCTURE_BARE_BLOCKS_CHECKS,
    ENVIRONMENT_READERS_CHECKS,
    FILE_FOLDER_CLASHES_CHECKS,
    STRUCTURE_FUNCTION_ORDER_CHECKS,
    STRUCTURE_IMPORT_RULES_CHECKS,
    STRUCTURE_JSCPD_CHECKS,
    STRUCTURE_EMPTY_FOLDERS_CHECKS,
    STRUCTURE_LONE_FILES_CHECKS,
    STRUCTURE_LONG_FILES_CHECKS,
    PASS_THROUGH_FOLDERS_CHECKS,
    STRUCTURE_SHARED_PREFIXES_CHECKS,
    STRUCTURE_TRIVIAL_FUNCTIONS_CHECKS,
    SUPABASE_CHECKS,
    SVELTE_CHECKS,
    SWIFT_BUILD_CHECKS,
    SWIFT_PERIPHERY_CHECKS,
    SWIFT_SECURITY_CHECKS,
    SWIFT_SKIP_REASONS_CHECKS,
    SWIFT_SWIFTLINT_ANALYZE_CHECKS,
    SWIFT_TESTS_CHECKS,
    TRANSLATIONS_CHECKS,
    TSC_CHECKS,
    TYPESCRIPT_CHECKS,
    VITEST_CHECKS,
    XCODE_CHECKS,
    YAML_CHECKS,
]);

export const CONFIG_BUILDERS = joinTables<ConfigBuilder>([
    ANSIBLE_CONFIG_BUILDERS,
    BASH_CONFIG_BUILDERS,
    BIOME_CONFIG_BUILDERS,
    COMMITS_CONFIG_BUILDERS,
    CSS_CONFIG_BUILDERS,
    DEPENDENCIES_CONFIG_BUILDERS,
    DOCKER_CONFIG_BUILDERS,
    DOCS_CONFIG_BUILDERS,
    ESLINT_CONFIG_BUILDERS,
    FORMAT_CONFIG_BUILDERS,
    HTML_CONFIG_BUILDERS,
    JSCONFIG_CONFIG_BUILDERS,
    JSON_CONFIG_BUILDERS,
    KNIP_CONFIG_BUILDERS,
    MARKDOWN_CONFIG_BUILDERS,
    NGINX_CONFIG_BUILDERS,
    OPENAPI_CONFIG_BUILDERS,
    PERIPHERY_CONFIG_BUILDERS,
    POSTGRES_CONFIG_BUILDERS,
    PROSE_CONFIG_BUILDERS,
    PYTEST_CONFIG_BUILDERS,
    PYTHON_CONFIG_BUILDERS,
    SITE_CONFIG_BUILDERS,
    SPELLING_CONFIG_BUILDERS,
    SQL_CONFIG_BUILDERS,
    STRUCTURE_CONFIG_BUILDERS,
    SWIFTFORMAT_CONFIG_BUILDERS,
    SWIFTLINT_CONFIG_BUILDERS,
    TOML_CONFIG_BUILDERS,
]);

export function selectCheckCode(check: Check): CheckCode | undefined {
    if (check.generator_outputs !== undefined)
        return { check: checkGeneratorOutputs, explanations: GENERATOR_OUTPUT_EXPLANATIONS };
    return CHECK_CODE[check.id];
}
