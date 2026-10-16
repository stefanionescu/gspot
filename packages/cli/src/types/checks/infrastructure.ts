import type { TrackedFile } from '#cli/types/repository/inventory.ts';

/** One authored service declaration retains its service name and finding path. */
type ComposeDeclaration = { name: string; path: string; service: ComposeService };

/** One ordered Compose invocation, with the final file owned by output attribution. */
export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

/** Parsed service declarations and conservative ignore candidates share one project read. */
export type ComposeDocuments = { declarations: ComposeDeclaration[]; contexts: Map<string, string[]> };

/** One repository configuration copied for a container mount. */
export type Mount = { path: string; source: string; target: string; text: string };

/** Configuration and temporary TLS mounts for validating nginx inside its container. */
export type NginxMounts = { configs: Pick<Mount, 'source' | 'target'>[]; certificate: string; key: string };

/** One validated service consumed by build-context and image checks. */
export type ComposeService = {
    image?: string | undefined;
    build?:
        | { context: string; dockerfile: undefined }
        | { context?: string | undefined; dockerfile?: string | undefined }
        | undefined;
};

export type DirectiveScan = { token: string | undefined; end: number };

export type ParsedOpenapi = { document?: string | undefined; generate_command?: string[] | undefined };

export type ParsedXcode = {
    allowed_entitlements: string[];
};
