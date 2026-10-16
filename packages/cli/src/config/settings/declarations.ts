import { NAMING_TABLE_CATEGORIES } from '#cli/config/settings/schema.ts';
import { TOOLS_DECLARATIONS } from '#cli/config/settings/tools-declarations.ts';
import { LIMITS_DECLARATIONS } from '#cli/config/settings/limits-declarations.ts';
import { RECORD_DECLARATIONS } from '#cli/config/settings/record-declarations.ts';

export const SETTING_DECLARATIONS = {
    ...LIMITS_DECLARATIONS,
    ...TOOLS_DECLARATIONS,
    ...RECORD_DECLARATIONS,
    'repository.max_file_kilobytes': {
        configurations: ['repository'],
        description:
            'The largest file Git may track, in kilobytes. Larger files need Git LFS or a linguist-generated or linguist-vendored mark in .gitattributes.',
        reason_needed: 'raising',
    },
    'prose.max_sentence_words': {
        configurations: ['prose'],
        description: 'The most words one sentence of documentation may have.',
        reason_needed: 'raising',
    },
    'prose.max_list_item_words': {
        configurations: ['prose'],
        description: 'The most words one list item may have.',
        reason_needed: 'raising',
    },
    'prose.max_paragraph_sentences': {
        configurations: ['prose'],
        description: 'The most sentences one paragraph may have.',
        reason_needed: 'raising',
    },
    'duplication.min_lines': {
        configurations: ['duplication'],
        description: 'The fewest lines a copied block has before it counts.',
        reason_needed: 'raising',
    },
    'duplication.min_tokens': {
        configurations: ['duplication'],
        description: 'The fewest tokens a copied block has before it counts.',
        reason_needed: 'raising',
    },
    'naming.banned_words': {
        configurations: ['naming'],
        description: 'Words this repository bans in identifiers, beyond the shipped groups.',
    },
    'naming.override': {
        configurations: ['naming'],
        description: 'Naming rules for repository-relative paths, in order; each record has its reason.',
    },
    'swift.xcode_project': {
        configurations: ['swift'],
        description:
            'The Xcode project or workspace, relative to the repository root. Init writes a detected project; when absent, use the Swift package.',
    },
    'swift.xcode_scheme': {
        configurations: ['swift'],
        description: 'The shared scheme the build, the analyzer, and Periphery use.',
    },
    'swift.xcode_destination': {
        configurations: ['swift'],
        description: 'The xcodebuild destination.',
    },
    'xcode.allowed_entitlements': {
        configurations: ['xcode'],
        description: 'The entitlements the app may hold; empty turns the check off.',
    },
    'licenses.allowed': {
        configurations: ['licenses'],
        description: 'The SPDX license ids a dependency may report.',
    },
    'licenses.allowed_package': {
        configurations: ['licenses'],
        description: 'Packages accepted under a license outside the list: name, exact version, and reason.',
    },
    'structure.reexports': {
        configurations: ['structure'],
        reason_needed: 'adding',
        description: 'Whether re-exports are allowed: none, or an index file that re-exports other files.',
    },
    'cloudflare.types_file': {
        configurations: ['cloudflare'],
        description: 'Tracked Worker environment types file, relative to the repository root.',
    },
    'cloudflare.types_interface': {
        configurations: ['cloudflare'],
        description: 'Environment interface name passed to wrangler types; OpenNext uses CloudflareEnv.',
    },
    'coverage.lines': {
        configurations: ['coverage'],
        description: 'The minimum percentage of source lines covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    'coverage.branches': {
        configurations: ['coverage'],
        description: 'The minimum percentage of source branches covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    'coverage.functions': {
        configurations: ['coverage'],
        description: 'The minimum percentage of source functions covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    'coverage.statements': {
        configurations: ['coverage'],
        description: 'The minimum percentage of source statements covered by tests.',
        default_all: 80,
        reason_needed: 'lowering',
    },
    'coverage.swift_target': {
        configurations: ['coverage'],
        description: 'Line coverage floors for named Swift targets.',
    },
    'dependencies.min_release_age_days': {
        configurations: ['dependencies'],
        description: 'How many days a new release waits before any installer that gspot sets up may install it.',
        reason_needed: 'lowering',
    },
    'dependencies.allowed_registries': {
        configurations: ['dependencies'],
        description: 'The hosts a lockfile may resolve packages from.',
        reason_needed: 'adding',
    },
    'dependencies.bun_scanner': {
        configurations: ['dependencies'],
        description: 'The security scanner package Bun runs on install. When absent, no scanner is required.',
    },
    'docs.banned_headings': {
        configurations: ['docs'],
        description: 'Headings this repository bans beyond the shipped list.',
    },
    'docs.allowed_urls': {
        configurations: ['docs'],
        description: 'Allowed URL patterns; additions need a reason for the whole list.',
        reason_needed: 'adding',
    },
    'drizzle.client_names': {
        configurations: ['drizzle'],
        description: 'The Drizzle client identifiers checked for update and delete operations without a where clause.',
    },
    'openapi.document': {
        configurations: ['openapi'],
        description:
            'The committed OpenAPI document, relative to the repository root. Init writes a detected document; when absent, OpenAPI checks do not run.',
    },
    'openapi.generate_command': {
        configurations: ['openapi'],
        description: 'The command that writes the OpenAPI document from the code, run in the project scope folder.',
    },
    'postgres.client_schemas': {
        configurations: ['postgres'],
        description: 'The schemas clients reach, where every table needs row level security.',
    },
    'postgres.frozen_through': {
        configurations: ['postgres'],
        description:
            'The version through which migrations have run everywhere: none, all, or a version. Squawk skips them, and they may not change.',
    },
    'postgres.migrations_folder': {
        configurations: ['postgres'],
        description:
            'The migrations folder relative to the repository root. When absent, use the migration files this configuration owns.',
    },
    'secrets.env_examples': {
        configurations: ['secrets'],
        description:
            'The example environment filenames searched for supported environment keys; a key may appear in any one example file.',
    },
    'secrets.environment_functions': {
        configurations: ['secrets'],
        description:
            'The project functions that read environment keys, in addition to the built-in readers; for example config.$env and read_env.',
    },
    'site.build_command': {
        configurations: ['site'],
        description: 'The build script run by the repository package manager, unless your own command replaces it.',
    },
    'site.build_folder': {
        configurations: ['site'],
        description: 'The folder the build writes.',
    },
    'site.allowed_unlisted_pages': {
        configurations: ['site'],
        description: 'Built pages the sitemap leaves out on purpose.',
        reason_needed: 'adding',
    },
    'site.size_limit': {
        configurations: ['site'],
        description: 'Weight ceilings: the built paths, and the most kilobytes they may weigh compressed.',
    },
    'spelling.locale': {
        configurations: ['spelling'],
        description: 'The English locale typos checks against: en, en-us, en-gb, en-ca, or en-au.',
    },
    'supabase.functions_folder': {
        configurations: ['supabase'],
        description:
            'The folder relative to the repository root that holds one folder for each edge function. The default is relative to the project scope.',
    },
    'supabase.schemas': {
        configurations: ['supabase'],
        description: 'The database schemas to include in generated types.',
    },
    'supabase.types_file': {
        configurations: ['supabase'],
        description:
            'The committed database types file, relative to the repository root. When absent, no type comparison runs.',
    },
    'translations.base_locale': {
        configurations: ['translations'],
        description: 'The locale whose message keys every other locale must contain.',
    },
    'translations.messages_folder': {
        configurations: ['translations'],
        description: 'The folder of `<locale>`.json message files, relative to the repository root.',
    },
    'format.indent_style': {
        configurations: ['format'],
        description: 'What one indent level is made of: space or tab.',
    },
    'format.indent_width': {
        configurations: ['format'],
        description: 'Spaces per indent level.',
    },
    'format.print_width': {
        configurations: ['format'],
        description: 'The line width formatters wrap at.',
    },
    'format.line_ending': {
        configurations: ['format'],
        description: 'The line ending every file uses: lf or crlf.',
    },
    'format.final_newline': {
        configurations: ['format'],
        description: 'Whether every file ends with a newline.',
    },
    'format.quotes': {
        configurations: ['format'],
        description: 'single or double, for the languages where a formatter chooses.',
    },
    'format.trailing_commas': {
        configurations: ['format'],
        description: 'Where trailing commas go: all, es5, or none.',
    },
    'format.semicolons': {
        configurations: ['format'],
        description: 'Whether JavaScript and TypeScript statements end with semicolons.',
    },
    'format.override': {
        configurations: ['format'],
        description: 'Formatting options for repository-relative paths, in order.',
    },
    configurations: {
        description:
            'Configurations you chose by hand, on top of the ones gspot detects. `gspot add` writes it; `gspot set` refuses it.',
    },
    removed_configurations: {
        description:
            'Configurations you removed; detection does not add them back. Only `gspot add` and `gspot remove` write it; `gspot set` and `gspot unset` refuse it.',
    },
    'ci.enabled': { description: 'Write a CI workflow. Root only.' },
    'ci.provider': { description: 'Which CI gets the workflow. Root only.' },
    'ci.setup_command': { description: 'A command CI runs before `gspot install`, such as `npm ci`. Root only.' },
    'scope.path': { description: 'The folder. Two records may not name the same folder.' },
    'scope.configurations': {
        description: 'Configurations for this folder, on top of the root ones. `gspot add --scope` writes it.',
    },
    'scope.removed_configurations': {
        description: 'Configurations removed in this folder. Only `gspot add` and `gspot remove` write it.',
    },
    'scope.test_files': { description: 'More test files for this folder. Adds to the root list.' },
    'naming.max_characters': {
        configurations: ['naming'],
        description: 'The most characters one identifier may have.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql'],
        categories: NAMING_TABLE_CATEGORIES,
        language_defaults: { swift: 40, sql: 55 },
    },
    'naming.max_words': {
        configurations: ['naming'],
        description: 'The most words one identifier may have.',
        reason_needed: 'raising',
        languages: ['typescript', 'javascript', 'python', 'bash', 'swift', 'sql'],
        categories: NAMING_TABLE_CATEGORIES,
        language_defaults: { swift: 5, sql: 7 },
    },
    'naming.cases': {
        configurations: ['naming'],
        description:
            'The case patterns one identifier category accepts: camel, pascal, kebab, snake, upper-snake, pascal-extension (String+Format.swift) and timestamp-snake (20260103120000_create_users.sql). Ruff owns the case of Python classes, functions, and parameters, and SwiftLint owns Swift types, variables, parameters, and enum cases; these settings choose the case for every other category.',
        reason_needed: 'adding',
        languages: ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'],
        categories: NAMING_TABLE_CATEGORIES,
    },
} as const;
