export const MINIMAL_PRESET = `
[preset]
id    = "language:bash"
kind  = "language"
title = "Bash"

[claims]
extensions = [".sh"]

[required]
".sh" = ["syntax", "spelling"]

[[checks]]
id        = "sh/syntax"
inspects  = ["syntax"]
mechanism = "configured"
stage     = "pre-commit"
takes     = "one-file"
command   = ["bash", "-n"]
fails_on  = "exit-code"
tools     = ["bash"]
file_list = { via = "declared" }

[[tasks]]
name   = "lint:bash"
scope  = "per-scope"
checks = ["sh/syntax"]
`

export const TWO_TASK_PRESET = `
[preset]
id    = "language:bash"
kind  = "language"
title = "Bash"

[claims]
extensions = [".sh"]

[required]
".sh" = ["syntax"]

[[checks]]
id        = "sh/syntax"
inspects  = ["syntax"]
mechanism = "configured"
stage     = "pre-commit"
takes     = "one-file"
command   = ["bash", "-n"]
fails_on  = "exit-code"
file_list = { via = "declared" }

[[checks]]
id        = "sh/build"
inspects  = ["output"]
mechanism = "configured"
stage     = "pre-push"
takes     = "project"
command   = ["make"]
fails_on  = "exit-code"
requires  = ["build"]
file_list = { via = "declared" }

[[tasks]]
name   = "lint:bash"
scope  = "per-scope"
checks = ["sh/syntax"]

[[tasks]]
name   = "check"
scope  = "repo"
checks = ["sh/syntax", "sh/build"]
deps   = ["lint:bash"]
`

export function presetOf(
  id: string,
  kind: string,
  requires: readonly string[] = [],
  conflicts: readonly string[] = [],
): string {
  return `
[preset]
id        = "${id}"
kind      = "${kind}"
title     = "${id}"
requires  = [${requires.map((entry) => `"${entry}"`).join(', ')}]
conflicts = [${conflicts.map((entry) => `"${entry}"`).join(', ')}]
`
}

export function claimingPreset(id: string, kind: string, extension: string): string {
  return `
[preset]
id    = "${id}"
kind  = "${kind}"
title = "${id}"

[claims]
extensions = ["${extension}"]

[required]
"${extension}" = ["syntax"]
`
}
