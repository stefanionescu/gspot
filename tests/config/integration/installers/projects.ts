export const TOOL_ADVISORY_EXCEPTIONS = [
    {
        package: 're2js',
        advisory: 'GHSA-gg6h-894w-4m9c',
        reason: 'markdownlint pins re2js 2.8.6 but never enables the LOOKBEHINDS flag required by the quadratic matching flaw.',
        recheck: '2026-11-28',
    },
    {
        package: 'katex',
        advisory: 'GHSA-238p-pmpm-9mq7',
        reason: 'markdownlint parses math syntax and never renders KaTeX output.',
        recheck: '2026-11-24',
    },
    {
        package: 'mcp',
        advisory: 'GHSA-84m7-p3x7-pcfv',
        reason: 'gspot runs semgrep scan only, never semgrep mcp.',
        recheck: '2026-11-24',
    },
    {
        package: 'mcp',
        advisory: 'GHSA-5h93-6whr-6q8j',
        reason: 'semgrep pins mcp 1.29.0. gspot runs semgrep scan without the MCP client transports that follow redirects.',
        recheck: '2026-11-28',
    },
    {
        package: 'mcp',
        advisory: 'GHSA-rwrf-2pqf-9j8j',
        reason: 'semgrep pins mcp 1.29.0. gspot runs semgrep scan without the MCP client that resolves tool output schemas.',
        recheck: '2026-11-28',
    },
    {
        package: 'mcp',
        advisory: 'GHSA-w4fh-qvv9-3v23',
        reason: 'semgrep pins mcp 1.29.0. gspot runs semgrep scan without an MCP server or bearer-token authentication.',
        recheck: '2026-11-28',
    },
    {
        package: 'opentelemetry-api',
        advisory: 'GHSA-xcq7-p3pf-p88h',
        reason: 'semgrep scan serves no HTTP request, so it never parses an inbound tracestate header.',
        recheck: '2026-11-24',
    },
] as const;
