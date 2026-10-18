export type ParsedDrizzle = { client_names: string[] };

export type ParsedZustand = { store_files: string[] };

export type ParsedTrpc = { router_files: string[]; server_files: string[] };

export type ParsedTranslations = { base_locale: string; messages_folder?: string | undefined };
