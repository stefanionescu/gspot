#!/usr/bin/env bash

# assert_release_commit: Refuses an unpushed, changed, or untested main commit.
assert_release_commit() {
    local commit
    local branch
    local changes
    local remote_commit
    local workflow
    local conclusion

    branch=$(git branch --show-current)
    if [[ ${branch} != main ]]; then
        printf 'Release requires the main branch.\n' >&2
        return 1
    fi
    changes=$(git status --porcelain)
    if [[ -n ${changes} ]]; then
        printf 'Release requires committed files:\n' >&2
        git status --short >&2
        return 1
    fi
    git fetch origin main --tags || return 1
    commit=$(git rev-parse HEAD)
    remote_commit=$(git rev-parse origin/main)
    if [[ ${commit} != "${remote_commit}" ]]; then
        printf 'Release requires HEAD to equal origin/main.\n' >&2
        return 1
    fi
    for workflow in tests.yml gspot.yml; do
        conclusion=$(gh run list --workflow "${workflow}" --commit "${commit}" --json conclusion --jq '.[0].conclusion') || return 1
        if [[ ${conclusion} != success ]]; then
            printf '%s has not passed on %s.\n' "${workflow}" "${commit}" >&2
            return 1
        fi
    done
}

# assert_published_code: Refuses changes under a version that npm already serves.
# Arguments:
#   Package folder.
#   Tag prefix.
assert_published_code() {
    local folder="$1"
    local prefix="$2"
    local name
    local version
    local published

    version=$(package_field "${folder}" version)
    name=$(package_field "${folder}" name)
    published=$(registry_version "${name}@${version}")
    if [[ -n ${published} ]] && ! git diff --quiet "${prefix}${version}" HEAD -- "${folder}"; then
        printf '%s changed since published tag %s%s. Change its version first.\n' "${folder}" "${prefix}" "${version}" >&2
        return 1
    fi
}

# assert_release_ready: Checks commands, logins, commit, pins, and published code before building.
assert_release_ready() {
    local command_name
    local published_version
    local requested_version

    for command_name in npm gh git bun jq curl mise; do
        if ! command -v "${command_name}" >/dev/null 2>&1; then
            printf 'Release requires command %s.\n' "${command_name}" >&2
            return 1
        fi
    done
    npm whoami || return 1
    gh auth status || return 1
    bun run --cwd docs wrangler whoami || return 1
    assert_release_commit
    published_version=$(registry_version '@gspothq/cli@latest')
    requested_version=$(mise config get --file mise.toml 'tools.npm:@gspothq/cli.version') || return 1
    if [[ ${requested_version} != "${published_version}" || -z ${published_version} ]]; then
        printf 'mise.toml must pin npm:@gspothq/cli to npm latest %s.\n' "${published_version}" >&2
        return 1
    fi
    assert_published_code packages/eslint-plugin eslint-plugin-v
    assert_published_code packages/cli v
    bun packages/cli/pin-ages.ts
}
