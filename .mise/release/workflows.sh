#!/usr/bin/env bash
# The CI checks that the release and publish tasks share.

# assert_run_passed: Refuses a commit whose latest run of a workflow did not pass.
# Arguments:
#   Workflow file.
#   Commit hash.
#   What to do about it, printed after the refusal.
#   Any other filters of gh run list.
# Returns:
#   1 when the run did not pass, or gh fails.
assert_run_passed() {
    local workflow="$1"
    local commit="$2"
    local fix="$3"
    local conclusion

    conclusion=$(gh run list --workflow "${workflow}" --commit "${commit}" "${@:4}" --json conclusion --jq '.[0].conclusion') || return 1
    if [[ ${conclusion} != success ]]; then
        printf '%s has not passed on %s.%s\n' "${workflow}" "${commit}" "${fix}" >&2
        return 1
    fi
}

# assert_workflows_passed: Refuses a commit that has not passed on all three systems, or in the gspot workflow.
# Arguments:
#   Commit hash.
# Returns:
#   1 when a workflow has no passed run on the commit, or gh fails.
assert_workflows_passed() {
    local commit="$1"

    assert_run_passed tests.yml "${commit}" ' A push tests Ubuntu only. Run gh workflow run tests.yml --ref main to test all three systems.' --event workflow_dispatch
    assert_run_passed gspot.yml "${commit}" ''
}
