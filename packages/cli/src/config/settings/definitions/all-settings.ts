import { BUILD_SCRIPT } from '#cli/config/settings/available.ts';
import type { SettingDefinition } from '#cli/types/settings/definitions.ts';
import { LIMIT_DEFINITIONS } from '#cli/config/settings/definitions/limits.ts';
import { FORMAT_DEFINITIONS } from '#cli/config/settings/definitions/format.ts';
import { NAMING_DEFINITIONS } from '#cli/config/settings/definitions/naming.ts';
import { ROOT_SETTING_DEFINITIONS } from '#cli/config/settings/definitions/root.ts';
import { LANGUAGE_DEFINITIONS } from '#cli/config/settings/definitions/languages.ts';
import { TOOL_SETTING_DEFINITIONS } from '#cli/config/settings/definitions/tools.ts';
import { RECORD_FIELD_DEFINITIONS } from '#cli/config/settings/definitions/record-fields.ts';

export const SETTING_DEFINITIONS = {
    ...ROOT_SETTING_DEFINITIONS,
    ...NAMING_DEFINITIONS,
    ...FORMAT_DEFINITIONS,
    ...LIMIT_DEFINITIONS,
    ...TOOL_SETTING_DEFINITIONS,
    ...RECORD_FIELD_DEFINITIONS,
    ...LANGUAGE_DEFINITIONS,
    'repository.max_file_kilobytes': {
        configurations: ['repository'],
        description:
            'The largest file, in kilobytes, that Git may track without Git LFS or a linguist-generated or linguist-vendored mark in .gitattributes.',
        reason_when: 'raising',
        default: 1024,
    },
    'prose.banned_headings': {
        configurations: ['prose'],
        description: 'Headings this repository bans beyond the shipped list.',
        default: [] as [],
    },
    'prose.max_sentence_words': {
        configurations: ['prose'],
        description: 'The most words one sentence of documentation may have.',
        reason_when: 'raising',
        default: 30,
    },
    'prose.max_list_item_words': {
        configurations: ['prose'],
        description: 'The most words one list item may have.',
        reason_when: 'raising',
        default: 45,
    },
    'prose.max_paragraph_sentences': {
        configurations: ['prose'],
        description: 'The most sentences one paragraph may have.',
        reason_when: 'raising',
        default: 6,
    },
    'duplication.min_lines': {
        configurations: ['duplication'],
        description: 'The fewest lines a copied block has before it counts.',
        reason_when: 'raising',
        default: 8,
    },
    'duplication.min_tokens': {
        configurations: ['duplication'],
        description: 'The fewest tokens a copied block has before it counts.',
        reason_when: 'raising',
        default: 40,
    },
    'swift.xcode_project': {
        configurations: ['swift'],
        description:
            'The Xcode project or workspace, relative to the repository root, which init fills in when it finds one; without it, the checks use the Swift package.',
    },
    'swift.xcode_scheme': {
        template: 'repository',
        configurations: ['swift'],
        description: 'The shared scheme the build, the analyzer, and Periphery use.',
    },
    'swift.xcode_destination': {
        template: 'repository',
        configurations: ['swift'],
        description: 'The xcodebuild destination.',
        default: 'generic/platform=iOS Simulator',
    },
    'xcode.allowed_entitlements': {
        template: 'repository',
        configurations: ['xcode'],
        description: 'The entitlements the app may hold; empty turns the check off.',
        default: [] as [],
    },
    'licenses.allowed': {
        configurations: ['licenses'],
        description: 'The SPDX license IDs a dependency may report.',
        default: [] as [],
    },
    'structure.reexports': {
        configurations: ['structure'],
        reason_when: 'adding',
        description: 'Where re-exports may go: none, or an index file that re-exports other files.',
        default: 'none',
    },
    'cloudflare.types_file': {
        configurations: ['cloudflare'],
        description: 'Tracked Worker types file from the repository root; OpenNext defaults to cloudflare-env.d.ts.',
        default: 'worker-configuration.d.ts',
    },
    'cloudflare.types_interface': {
        template: 'repository',
        configurations: ['cloudflare'],
        description: 'Environment interface name passed to wrangler types; OpenNext defaults to CloudflareEnv.',
        default: 'Env',
    },
    'coverage.lines': {
        configurations: ['jest', 'pytest', 'vitest', 'swift'],
        description: 'The minimum percentage of source lines covered by tests.',
        default_all: 80,
        reason_when: 'lowering',
        default: 0,
    },
    'coverage.branches': {
        configurations: ['jest', 'vitest'],
        description: 'The minimum percentage of source branches covered by tests.',
        default_all: 80,
        reason_when: 'lowering',
        default: 0,
    },
    'coverage.functions': {
        configurations: ['jest', 'vitest'],
        description: 'The minimum percentage of source functions covered by tests.',
        default_all: 80,
        reason_when: 'lowering',
        default: 0,
    },
    'coverage.statements': {
        configurations: ['jest', 'vitest'],
        description: 'The minimum percentage of source statements covered by tests.',
        default_all: 80,
        reason_when: 'lowering',
        default: 0,
    },
    'dependencies.min_release_age_days': {
        configurations: ['dependencies'],
        description:
            'How many days a package waits after its release before gspot installs it in .gspot. The hold covers the pinned tools and the packages they pull in; only the gspot packages install at the version of the CLI. A pinned tool that came out later stops the install. Bun does not hold back a package pinned to one version. gspot applies the hold when it writes a tool lockfile: a committed tool lockfile that matches the pins installs as it is, without the hold.',
        reason_when: 'lowering',
        default: 7,
    },
    'dependencies.allowed_registries': {
        configurations: ['dependencies'],
        description: 'The hosts a lockfile may resolve packages from.',
        reason_when: 'adding',
        default: ['registry.npmjs.org', 'registry.yarnpkg.com'] as ['registry.npmjs.org', 'registry.yarnpkg.com'],
    },
    'dependencies.bun_scanner': {
        template: 'code',
        configurations: ['dependencies'],
        description: 'The npm package that Bun runs as its install security scanner. Without it, Bun runs no scanner.',
    },
    'docs.allowed_urls': {
        configurations: ['docs'],
        description: 'Allowed URL patterns; additions need a reason for the whole list.',
        reason_when: 'adding',
        default: [] as [],
    },
    'drizzle.client_names': {
        template: 'repository',
        configurations: ['drizzle'],
        description: 'The Drizzle client identifiers checked for update and delete operations without a where clause.',
        default: ['db'] as ['db'],
    },
    'openapi.document': {
        configurations: ['openapi'],
        description:
            'The committed OpenAPI document, relative to the repository root, which init fills in when it finds one; without it, the OpenAPI checks do not run.',
    },
    'openapi.generate_command': {
        template: 'code',
        configurations: ['openapi'],
        description: 'The command that writes the OpenAPI document from the code, run in the project scope folder.',
    },
    'postgres.client_schemas': {
        template: 'repository',
        configurations: ['postgres'],
        description: 'The schemas clients reach, where every table needs row level security.',
        default: [] as [],
    },
    'postgres.frozen_through': {
        template: 'repository',
        configurations: ['postgres'],
        description:
            'The last migration version that has run everywhere (none, all, or a version); Squawk skips those migrations, and they may not change.',
        default: 'none',
    },
    'postgres.migrations_folder': {
        configurations: ['postgres'],
        description:
            'The migrations folder, relative to the repository root; without it, the checks use the migration files of this configuration.',
    },
    'secrets.env_examples': {
        configurations: ['secrets'],
        description:
            'The example environment files to search for environment keys; a key may appear in any one of them.',
        default: ['.env.example', '.env.template', '.env.sample', '.dev.vars.example'] as [
            '.env.example',
            '.env.template',
            '.env.sample',
            '.dev.vars.example',
        ],
    },
    'secrets.environment_functions': {
        template: 'repository',
        configurations: ['secrets'],
        description:
            'Functions of this project that read environment variables, such as read_env. secrets/env-examples reads the keys they take.',
        default: [] as [],
    },
    'site.build_command': {
        template: 'code',
        configurations: ['site'],
        description:
            'The command that builds the site. Without it, gspot runs the build script of the package manager.',
        default: ['npm', ...BUILD_SCRIPT] as string[],
    },
    'site.build_folder': {
        configurations: ['site'],
        description: 'The folder the build writes.',
        default: 'dist',
    },
    'site.allowed_unlisted_pages': {
        configurations: ['site'],
        description: 'Built pages the sitemap leaves out on purpose.',
        reason_when: 'adding',
        default: ['404.html'] as ['404.html'],
    },
    'spelling.allowed_words': {
        configurations: ['spelling'],
        reason_values: true,
        description:
            'Words the spelling checks accept beyond the shipped spelling list, each with the reason it is a real word. A scope adds its words to the root words.',
        default: {},
    },
    'spelling.locale': {
        configurations: ['spelling'],
        description:
            'The English locale typos checks against: en accepts every dialect; en-us, en-gb, en-ca, and en-au report the spellings of the other dialects. The fixer never changes a dialect spelling.',
        default: 'en',
    },
    'supabase.functions_folder': {
        configurations: ['supabase'],
        description:
            'The folder, relative to the repository root, with one folder for each edge function; the default starts from the project scope.',
        default: 'supabase/functions',
    },
    'supabase.schemas': {
        template: 'repository',
        configurations: ['supabase'],
        description: 'The database schemas to include in generated types.',
        default: ['public'] as ['public'],
    },
    'supabase.types_file': {
        configurations: ['supabase'],
        description:
            'The committed database types file, relative to the repository root; without it, no type comparison runs.',
    },
    'translations.base_locale': {
        template: 'repository',
        configurations: ['translations'],
        description: 'The locale whose message keys every other locale must contain.',
        default: 'en',
    },
    'translations.messages_folder': {
        configurations: ['translations'],
        description: 'The folder of the `<locale>.json` message files, relative to the repository root.',
    },

    'structure.environment_readers': {
        configurations: ['structure'],
        description:
            'The files that may read environment variables; other files get the values passed in. Empty turns the check off.',
        default: [] as [],
    },
    'trpc.router_files': {
        configurations: ['trpc'],
        description: 'The files that declare tRPC procedures.',
        default: ['**/routers/**', '**/*router*.ts', '**/trpc/**'] as ['**/routers/**', '**/*router*.ts', '**/trpc/**'],
    },
    'trpc.server_files': {
        configurations: ['trpc'],
        description:
            'The server files that other files of a tRPC scope may import only as types; empty turns the rule off.',
        default: [] as [],
    },
    'zustand.store_files': {
        reason_when: 'adding',
        configurations: ['zustand'],
        description: 'The files that may create a store.',
        default: ['**/store.*', '**/stores/*', '**/store/*', '**/*.store.*'] as [
            '**/store.*',
            '**/stores/*',
            '**/store/*',
            '**/*.store.*',
        ],
    },
} as const satisfies Record<string, SettingDefinition>;
