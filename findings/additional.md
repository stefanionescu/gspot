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

## Header comments before JavaScript classes

The default ESLint JavaScript parser omits the `decorators` field on class declarations.
The header rule indexed that field while identifying the statement after an import block.
An ordinary class, named export, or default export therefore crashed linting.

Read decorator positions only when the parser supplies them. Preserve comments attached to
classes and keep the import-header fix. The three default-parser regressions fail on the
previous implementation and pass after the repair. The installed package also lints a class
through both module exports and both presets.
