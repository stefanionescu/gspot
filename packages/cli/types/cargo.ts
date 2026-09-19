// Types of what cargo and its subcommands print as JSON.

/** One line of cargo --message-format=json. */
export type CompilerLine = {
    reason: string;
    message?: {
        level: string;
        message: string;
        code?: { code: string } | null;
        spans: { file_name: string; line_start: number; column_start: number; is_primary: boolean }[];
    };
};

/** What cargo audit --json prints. */
export type AuditReport = {
    vulnerabilities: {
        list: {
            advisory: { id: string; title: string };
            package: { name: string; version: string };
            versions: { patched: string[] };
        }[];
    };
};

/** One line of cargo deny --format json. */
export type DenyLine = {
    type: string;
    fields: { severity: string; message: string; code?: string };
};
