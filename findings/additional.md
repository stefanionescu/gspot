# Findings From Implementation Verification

1 unresolved review record remains. Its ID and verification evidence are retained in the JSON checklist.

## Next.js link validation

<!-- finding: additional/next-app-router-links -->

The native `no-html-link-for-pages` rule misses an App Router anchor to the existing local `app/about/page.jsx` route. It still misses this link with the correct scope root at level `all`.

Its App Router path normalization differs from href normalization. Preserve Pages Router coverage. Establish valid and defective App Router cases before choosing a repair or replacement.

## Status on October 6, 2026

A read-only verification checked every record against the code at commit `3e1445a2d`. "Partial" means part of the fix is done. The location column gives the current file, because many files moved after the record was written.

| ID                                 | Status | Current location and evidence                                                                                                                                                                 | What remains                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `additional/next-app-router-links` | open   | packages/cli/configurations/framework/nextjs/eslint.fragment.js.tmpl:1-2 enables no-html-link-for-pages when app/ exists; tests/cli/generation/eslint/nextjs.test.ts covers only Pages Router | In `packages/cli/configurations/framework/nextjs/eslint.fragment.js.tmpl:1`, compute `hasRoutes` from `pages/` and `src/pages/` only (drop `app/` and `src/app/`), so `@next/next/no-html-link-for-pages` is on only for the Pages Router. The upstream rule misreads App Router paths: `parseUrlForAppDir` in `@next/eslint-plugin-next` 16.3.6 reads subfolders with `parseUrlForPages`, so `app/about/page.jsx` becomes `/about/page`. Report this upstream. In `tests/cli/generation/eslint/nextjs.test.ts`, keep the Pages Router case and add a sandbox with only `app/about/page.jsx` and `<a href="/about">` that asserts the generated configuration sets the rule to `off`. |
