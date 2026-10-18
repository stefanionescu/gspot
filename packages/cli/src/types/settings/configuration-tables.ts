import type { COVERAGE_DIMENSIONS } from '#cli/config/planning.ts';
import type { SPELLING_LOCALES } from '#cli/config/settings/schema.ts';

/** One package version allowed under a license that the list does not allow. */
type AllowedPackage = { name: string; version: string; reason: string };

/** The parsed table of each configuration in gspot.toml, by table name. */
export type ConfigurationTables = {
    cloudflare: { types_file: string; types_interface: string };
    coverage: Record<(typeof COVERAGE_DIMENSIONS)[number], number> & {
        swift_target: { name: string; lines: number; reason?: string | undefined }[];
    };
    dependencies: {
        min_release_age_days: number;
        allowed_registries: string[];
        bun_scanner?: string | undefined;
    };
    docs: { banned_headings: string[]; allowed_urls: string[] };
    drizzle: { client_names: string[] };
    duplication: { min_lines: number; min_tokens: number };
    javascript: { script_files: string[] };
    licenses: { allowed: string[]; allowed_package: AllowedPackage[] };
    openapi: { document?: string | undefined; generate_command?: string[] | undefined };
    postgres: {
        client_schemas: string[];
        frozen_through: string;
        migrations_folder?: string | undefined;
    };
    prose: { max_sentence_words: number; max_list_item_words: number; max_paragraph_sentences: number };
    repository: { max_file_kilobytes: number };
    secrets: { env_examples: string[]; environment_functions: string[] };
    site: {
        build_command: string[];
        build_folder: string;
        allowed_unlisted_pages: string[];
        size_limit: { paths: string[]; kilobytes: number }[];
    };
    spelling: { locale: (typeof SPELLING_LOCALES)[number] };
    supabase: { functions_folder: string; schemas: string[]; types_file?: string | undefined };
    swift: {
        xcode_project?: string | undefined;
        xcode_scheme?: string | undefined;
        xcode_destination: string;
    };
    translations: { base_locale: string; messages_folder?: string | undefined };
    trpc: { router_files: string[]; server_files: string[] };
    xcode: {
        allowed_entitlements: string[];
    };
    zustand: { store_files: string[] };
};
