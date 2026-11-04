import type { RuleExplanations } from '#cli/types/tools.ts';
import { WORKFLOW_SHAPE_RULES, WORKFLOW_SHAPE_MESSAGES } from '#cli/config/configurations/infrastructure.ts';

export const WORKFLOW_SHAPE_EXPLANATIONS = {
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
} as const satisfies RuleExplanations;
