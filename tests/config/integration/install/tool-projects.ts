export const TOOL_ADVISORY_EXCEPTIONS = [
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
        package: 'opentelemetry-api',
        advisory: 'GHSA-xcq7-p3pf-p88h',
        reason: 'semgrep scan serves no HTTP request, so it never parses an inbound tracestate header.',
        recheck: '2026-11-24',
    },
] as const;
