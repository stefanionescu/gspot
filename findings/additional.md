# Findings From Implementation Verification

## Links in Next.js apps

The pinned `@next/eslint-plugin-next@16.3.6` rule
`no-html-link-for-pages` returns no finding for an anchor with `href="/about"`
when the scope contains `app/about/page.jsx`. The positive case uses the scope's
actual root directory and the `all` level.

The installed primary implementation in `dist/utils/url.js` normalizes App Router
paths differently from the rule's normalized anchor URL. The original failing
case is recorded in `/tmp/gspot-next-xcode-regressions.log`. The Pages Router
scope tests pass in `tests/cli/generation/nextjs.test.ts`; they do not
establish App Router coverage.

Preserve the Pages Router cases. Add permanent App Router positive and defect
cases before choosing a repair or replacement, and verify scoped route isolation.

## Source-command startup marker readiness

The broad unit/integration run observed an empty JSON marker after its fixture opened the file
but before it wrote the data. The observer treated existence as readiness. Publish the fixture
marker by rename after a complete write, and enclose readiness assertions in graceful child
cleanup so an early failure still lets the source command remove its registry.
