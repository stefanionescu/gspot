#!/usr/bin/env bash
# The CI checks that the release and publish tasks share.

# assert_workflows_passed: Refuses a commit on which the tests or the gspot workflow has not passed.
# Arguments:
#   Commit hash.
# Returns:
#   1 when a workflow has no passed run on the commit, or gh fails.
assert_workflows_passed() {
    local commit="$1"
    local workflow
    local conclusion

    for workflow in tests.yml gspot.yml; do
        conclusion=$(gh run list --workflow "${workflow}" --commit "${commit}" --json conclusion --jq '.[0].conclusion') || return 1
        if [[ ${conclusion} != success ]]; then
            printf '%s has not passed on %s.\n' "${workflow}" "${commit}" >&2
            return 1
        fi
    done
}
