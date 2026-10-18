# GitHub Actions

Read this rule when you change a GitHub Actions workflow or action.

## Workflow shape

- Every job has `timeout-minutes`.
- Every workflow that can run twice for one ref has a `concurrency` group. Cancel a run in progress only for a pull
  request. Never cancel a run on the default branch or a tag; its result records that commit.
- Pin a runner image such as `ubuntu-24.04` for each job. Do not use `ubuntu-latest`.
- No `continue-on-error` without a reason comment. Required steps that break must fail the job.
- Upload diagnostics after failed checks with an explicit status condition. Deployments and release publication
  require successful prerequisites.
- Before a release job publishes a package or creates a release, it runs the tests or needs the job that does.

## Repository actions and secrets

- Reference first-party actions from the repository by path.
- Read secrets through `${{ secrets.NAME }}` into an `env` for the one step that needs them.
  Never write them to files that outlive the step.

## Scripts

- Declare the shell required by the script. The explicit Bash shell in GitHub Actions turns on `-e` and
  `pipefail`, but not `-u`. Enable required options and validate inputs explicitly.
- Key caches on the lockfile hash and the runtime version. Restore keys never match a
  different lockfile.

## Outputs

- Artifacts and summaries name the job and the ref. Set retention explicitly.
- Each job leaves a result that a later one, a deployment, or a person uses. Do not upload an artifact that no job
  downloads. Do not build the same output in two workflows.
- Give deploy credentials only to the job that deploys, as `env` on the step that needs them. Deploy only from the
  default branch or a release tag. When the repository uses GitHub environments, run the job in a protected
  one with a reviewer.

## Workflow organization

<!-- level: all -->

- Give each workflow one purpose, such as checks, release publication, or deployment.
- Call existing task-runner commands instead of copying their implementation into a workflow.
- Keep substantial logic in scripts that run locally through the task runner and in CI without
  a prompt. Run the checks their language requires.
- A verification job changes source only when its task requires formatting or code generation.
- Write logs and reports to predictable artifact paths.
