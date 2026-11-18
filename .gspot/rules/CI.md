# Continuous integration

Read this rule when you change a CI pipeline or make one faster.

## Results

- Run the full suite on each commit of the default branch, or in a merge queue before a change reaches it. Test
  selection by the diff only narrows the feedback of a pull request.
- Cancel a run in progress only when a newer commit of the same pull request replaces it. Never cancel a run on the
  default branch: each commit keeps its own result.
- Make no job faster with a retry, a longer time limit, a skipped test, or a step whose failure the job ignores. A test
  that passes only on a retry has a bug: fix it.
- When a pipeline selects tests by the diff, hide one change from the selection and confirm that the run fails.

## Measure first

Before you change a pipeline for speed, read its recent runs, such as the last 100 runs of the default branch. Split
each job into three parts, at the median and at the ninety-fifth percentile:

- Waiting: from the creation of the job to its start.
- Setup: checkout, tool installs, dependency installs, and the other steps before the work.
- Running: the steps that lint, type check, build, or test.

GitHub reports the start and end of each job and step through `gh api repos/<owner>/<repo>/actions/runs/<run-id>/jobs`.
GitLab reports `queued_duration` and `duration` for each job through its jobs API. Show the table to the user, then
change the largest part first.

## Fixes by part

Apply a fix only to the part that the measurement names.

- Waiting: keep the jobs that a run starts at once within the concurrency limit of the runner plan. Move a job to a
  paid runner only when the user agrees to its cost.
- Setup: cache tool installs and package downloads. Key each cache on the lockfile and on the runtime version, so that
  a pull request reads the cache that the default branch saved.
- Setup: keep a cache only when its restore step takes less time than it saves in the install. A cache of hundreds of
  megabytes can restore slower than its download.
- Setup: install every tool before the tests start, so that no test downloads a tool while it runs.
- Setup: install a system package from a cache or a container image, not from the package mirror in every job. A mirror
  can send a package at a few kilobytes per second.
- Setup: on a Windows runner, keep the package manager caches in the runner temp folder, which sits on the drive of the
  checkout.
- Running: split a suite into shards of similar duration, and match test workers to the cores of the runner. Run lint,
  type check, build, and tests as separate jobs, unless one needs the output of another.
- Running: a shard takes at least as long as its slowest test file. When one file holds the slowest tests, run them
  concurrently or split the file.
- When test files share one process to save setup time, run them in random order, so that a leak between files fails
  the run.

## Proof

- Make one change per commit, and give its numbers before and after from real runs. Revert a change that does not
  shrink its part.
- Compare the steps that a change touches, not the totals of the job. The speed of a runner moves those totals between
  runs.
- Set the time limit of each job from its measured ninety-fifth percentile, with a margin. A limit at the target fails
  healthy runs.
- Ask the user before a change that needs an account, a secret, or a larger bill. Name its expected monthly cost.
