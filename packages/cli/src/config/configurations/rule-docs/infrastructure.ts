import type { LintRuleDocs } from '#cli/types/tools.ts';
import { SYNTAX_RULE_DOCS } from '#cli/config/configurations/rule-docs/general.ts';

import {
    FROZEN_RULE,
    XCODE_RULES,
    POLICY_RULES,
    DOCKER_RULES,
    MIGRATION_RULES,
    DRIFT_GUARD_RULE,
    ROW_SECURITY_RULE,
    INSTRUCTION_RULES,
    MISSING_HEADER_RULE,
    SUPABASE_CHECK_RULES,
    WORKFLOW_SHAPE_RULES,
    WORKFLOW_SHAPE_MESSAGES,
} from '#cli/config/configurations/infrastructure.ts';

export const HEADER_RULE_DOCS = {
    [MISSING_HEADER_RULE]: {
        description:
            'The `/*` block of `_headers` sets `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and `X-Frame-Options` or a `frame-ancestors` policy.',
        why: 'Without them, browsers guess content types, send full URLs to other sites, and let other sites frame the pages.',
        fix: 'Add the missing headers to the `/*` block.',
        example: 'A `/*` block that sets only `Referrer-Policy: no-referrer` reports `missing-header`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const DOCKERIGNORE_RULE_DOCS = {
    [DOCKER_RULES.missingFile]: {
        description: 'Each Dockerfile has an ignore file, beside it or in its build context.',
        why: 'Without one, the build sends `.git`, `.env`, and other local files to the builder.',
        fix: 'Add a `.dockerignore` that lists `.git`, `.env`, and the paths that the configurations mark local.',
        example: 'A `Dockerfile` without `.dockerignore` or `Dockerfile.dockerignore` reports `missing-file`.',
    },
    [DOCKER_RULES.missingEntry]: {
        description: 'The ignore file lists `.git`, `.env`, and the local paths of the selected configurations.',
        why: 'A path that the ignore file leaves out can end up in the image.',
        fix: 'List each path that the finding names in the ignore file.',
        example: 'A `.dockerignore` without `.env` reports `missing-entry`.',
    },
    [DOCKER_RULES.ignoredSource]: {
        description: 'No `COPY` names a source that the ignore file excludes.',
        why: 'The builder never receives an excluded path, so the build fails or the image lacks the file.',
        fix: 'Remove the path from the ignore file, or remove it from the `COPY`.',
        example: '`COPY dist/ ./` with `dist` in `.dockerignore` reports `ignored-source`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const INSTRUCTION_RULE_DOCS = {
    [INSTRUCTION_RULES.lockfile]: {
        description: 'No `RUN` installs packages in a way that can rewrite the lockfile.',
        why: 'The image then holds other versions than the lockfile records.',
        fix: 'Install with `npm ci`, `pnpm install --frozen-lockfile`, or the locked mode of the package manager.',
        example: '`RUN npm install` reports `lockfile-install`; `RUN npm ci` does not.',
    },
    [INSTRUCTION_RULES.pipedDownload]: {
        description: 'No `RUN` pipes a download into a shell or an interpreter.',
        why: 'Nobody can review a script that runs as it downloads, and a cut-off download runs half a script.',
        fix: 'Fetch a fixed version to a file, compare its checksum, and run the file.',
        example: '`RUN curl -fsSL https://example.com/install.sh | sh` reports `piped-download`.',
    },
    [INSTRUCTION_RULES.nginxTag]: {
        description: 'A `FROM` of nginx pins a full version tag or a digest.',
        why: 'A floating tag such as `nginx:alpine` changes the server on the next build.',
        fix: 'Use a tag with major, minor, and patch versions, or pin the digest.',
        example: '`FROM nginx:1.27-alpine` reports `nginx-tag`; `FROM nginx:1.27.3-alpine` does not.',
    },
    [INSTRUCTION_RULES.shellEntrypoint]: {
        description: 'An `ENTRYPOINT` in exec form starts the program itself, not a shell.',
        why: 'The shell then runs as process 1, and it does not pass the stop signal to the program.',
        fix: 'Name the program as the first element, such as `ENTRYPOINT ["node", "server.js"]`.',
        example: '`ENTRYPOINT ["sh", "-c", "node server.js"]` reports `shell-entrypoint`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const WORKFLOW_SHAPE_RULE_DOCS = {
    [WORKFLOW_SHAPE_RULES.timeout]: {
        description: 'Each job that runs steps sets `timeout-minutes`.',
        why: 'A hung job otherwise runs for six hours and holds a runner.',
        fix: 'Set `timeout-minutes` on the job.',
        example: 'A `test` job without `timeout-minutes` reports `job-timeout`.',
    },
    [WORKFLOW_SHAPE_RULES.latestRunner]: {
        description: 'No job runs on a `-latest` runner image.',
        why: 'GitHub moves `-latest` to a new image, which changes the tools of every job at once.',
        fix: WORKFLOW_SHAPE_MESSAGES.latestRunner,
        example: '`runs-on: ubuntu-latest` reports `latest-runner`.',
    },
    [WORKFLOW_SHAPE_RULES.continueOnError]: {
        description: 'A comment above each `continue-on-error` says why the failure is allowed.',
        why: 'A step that may fail hides real failures unless the reason is clear.',
        fix: WORKFLOW_SHAPE_MESSAGES.continueOnError,
        example: '`continue-on-error: true` with no comment line above it reports `continue-on-error`.',
    },
    [WORKFLOW_SHAPE_RULES.runExpression]: {
        description: 'No `run:` script holds a GitHub Actions expression.',
        why: 'The runner pastes the value into the script before the shell reads it, so a crafted value runs as code.',
        fix: WORKFLOW_SHAPE_MESSAGES.runExpression,
        example: 'A `run:` line that inserts `github.head_ref` through an expression reports `run-expression`.',
    },
    [WORKFLOW_SHAPE_RULES.pullRequestConcurrency]: {
        description: 'A workflow that runs for pull requests has a `concurrency` group.',
        why: 'Without one, each push to a pull request starts another run, and the older runs keep their runners.',
        fix: 'Add a top-level `concurrency` group whose key includes the ref.',
        example: 'A workflow `on: pull_request` without `concurrency` reports `pull-request-concurrency`.',
    },
    [WORKFLOW_SHAPE_RULES.retention]: {
        description: 'Each `actions/upload-artifact` step sets `retention-days`.',
        why: 'Artifacts otherwise stay for the default of the repository and use its storage.',
        fix: WORKFLOW_SHAPE_MESSAGES.retention,
        example: 'An `upload-artifact` step with only `name` and `path` reports `artifact-retention`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const ASSET_RULE_DOCS = {
    [XCODE_RULES.emptySet]: {
        description: 'Each image set names at least one image file.',
        why: 'An empty set builds an asset that shows nothing.',
        fix: 'Add the image files to the set, or delete the set.',
        example: 'A `Logo.imageset/Contents.json` whose `images` entries have no `filename` reports `empty-set`.',
    },
    [XCODE_RULES.missingImage]: {
        description: 'Each image file that a set names exists in the set folder.',
        why: 'The app ships without that image, so the asset shows nothing at that size.',
        fix: 'Add the file to the set folder, or remove its entry from `Contents.json`.',
        example: 'A `Contents.json` that names `logo@2x.png` beside no such file reports `missing-image`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const BUILD_SETTING_RULE_DOCS = {
    [XCODE_RULES.strictConcurrency]: {
        description: 'Each target sets `SWIFT_STRICT_CONCURRENCY = complete` or builds with Swift 6.',
        why: 'Without it, the compiler lets data races through.',
        fix: 'Set `SWIFT_STRICT_CONCURRENCY = complete`, or move the target to Swift 6.',
        example: 'A target with `SWIFT_STRICT_CONCURRENCY = minimal` reports `strict-concurrency`.',
    },
    [XCODE_RULES.undeclaredScript]: {
        description: 'Each run-script phase declares its input or output files.',
        why: 'Without them, Xcode runs the script on every build and cannot order it with the other steps.',
        fix: 'List the files that the script reads and writes in the phase.',
        example: 'A run-script phase with empty input and output file lists reports `undeclared-script`.',
    },
    [XCODE_RULES.lintScript]: {
        description: 'No run-script phase runs SwiftLint or SwiftFormat.',
        why: 'gspot runs them at commit, so a build phase runs them twice and slows each build.',
        fix: 'Remove the lint step from the build phase.',
        example: 'A run-script phase that calls `swiftlint` reports `lint-script`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const XCSTRINGS_RULE_DOCS = {
    [XCODE_RULES.missingTranslation]: {
        description: 'Each string of a catalog has a translation for each locale that the catalog uses.',
        why: 'A string without a translation shows the source language to the users of that locale.',
        fix: 'Translate the string, or set `shouldTranslate` to false for it.',
        example:
            'A string with `de` and `fr` translations in a catalog that also uses `es` reports `missing-translation`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const EDITED_MIGRATION_RULE_DOCS = {
    [FROZEN_RULE]: {
        description: 'A committed migration keeps its committed text.',
        why: 'A database that already ran the migration skips the new text, so it drifts from a new database.',
        fix: 'Undo the edit, and put the change in a new migration.',
        example: 'A changed column type in a committed `20260101_create_orders.sql` reports `frozen`.',
    },
    [DRIFT_GUARD_RULE]: {
        description:
            'No migration after `postgres.frozen_through` uses `IF NOT EXISTS`, except `CREATE INDEX CONCURRENTLY`.',
        why: 'The guard skips the statement when the object exists in another shape, so the schema drifts unnoticed.',
        fix: 'Remove `IF NOT EXISTS`, so that the migration fails when the object already exists.',
        example: '`CREATE TABLE IF NOT EXISTS orders (id bigint)` reports `drift-guard`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const MIGRATION_ORDER_RULE_DOCS = {
    [MIGRATION_RULES.order]: {
        description: 'A new migration sorts after every committed migration.',
        why: 'A database that already ran the committed migrations skips an older version, or runs it out of order.',
        fix: 'Rename the new migration with a version after the newest committed one.',
        example: 'A new `20250101_add_index.sql` after a committed `20260101_create_orders.sql` reports `order`.',
    },
    [MIGRATION_RULES.version]: {
        description: 'Each migration file name starts with a version number.',
        why: 'The version sets the order in which the migrations run.',
        fix: 'Rename the file with a version prefix, such as a timestamp.',
        example: '`add_orders.sql` reports `version`; `20260103120000_add_orders.sql` does not.',
    },
    [MIGRATION_RULES.duplicateVersion]: {
        description: 'Each migration has its own version.',
        why: 'Two files with one version run in an order that the migration tool does not define.',
        fix: 'Give one of the files a new version.',
        example: '`20260101_create_orders.sql` and `20260101_create_users.sql` report `duplicate-version`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const ROW_SECURITY_RULE_DOCS = {
    [ROW_SECURITY_RULE]: {
        description: 'Each table in a schema of `postgres.client_schemas` turns on row level security.',
        why: 'Without it, any role that has a grant on the table reads and writes every row.',
        fix: 'Run `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` in a migration, and add policies.',
        example: 'A `public.orders` table without `ENABLE ROW LEVEL SECURITY` reports `row-security`.',
    },
    [POLICY_RULES.view]: {
        description: 'Each view in a client schema sets `security_invoker = true`.',
        why: 'A view runs as its owner by default, so it skips the row level security of its tables.',
        fix: 'Create the view `WITH (security_invoker = true)`.',
        example:
            '`CREATE VIEW public.order_totals AS SELECT ...` without the option reports `view-without-security-invoker`.',
    },
    [POLICY_RULES.roles]: {
        description: 'After the frozen migrations, each policy names its roles with `TO`.',
        why: 'A policy without `TO` applies to every role, `anon` included.',
        fix: 'Name the roles after `TO`, such as `TO authenticated`.',
        example: '`CREATE POLICY read_own ON orders USING (...)` without `TO` reports `policy-without-roles`.',
    },
    [POLICY_RULES.identityCall]: {
        description:
            'After the frozen migrations, a policy wraps `auth.uid()` and `current_setting()` in `(select ...)`.',
        why: 'A bare call runs once for each row, which slows queries on large tables.',
        fix: 'Write `(select auth.uid())` instead of `auth.uid()`.',
        example: '`USING (user_id = auth.uid())` reports `per-row-identity-call`.',
    },
    [POLICY_RULES.open]: {
        description: 'After the frozen migrations, a `USING (true)` policy has a comment that gives the reason.',
        why: 'An open policy gives the covered roles every row, and a reader needs to know that it is on purpose.',
        fix: 'Write a `--` comment next to the policy with the reason.',
        example: '`CREATE POLICY read_all ON plans USING (true);` with no comment reports `open-policy`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const DENO_CHECK_RULE_DOCS = {
    [SUPABASE_CHECK_RULES.typeError]: {
        description: 'The entry file of each edge function passes `deno check`.',
        why: 'A type error in an edge function fails when the function deploys or runs.',
        fix: 'Fix the type error at the reported line, then run the check again.',
        example: 'Passing a number where the handler expects a `Request` reports `type-error`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const STORAGE_POLICY_RULE_DOCS = {
    [SUPABASE_CHECK_RULES.bucketPolicy]: {
        description: 'A migration policy on `storage.objects` names each bucket of `supabase/config.toml`.',
        why: 'A bucket that no policy names has access rules that nobody wrote down.',
        fix: 'Add a policy on `storage.objects` that checks `bucket_id` for the bucket.',
        example: 'A bucket `avatars` that no policy names reports `bucket-policy`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
