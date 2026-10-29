#!/usr/bin/env bash

# release_notes: Prints breaking changes and feature and fix subjects since the previous CLI tag.
# Arguments:
#   CLI version being released.
release_notes() {
    local version="$1"
    local previous
    local messages
    local subjects
    local line
    local subject_pattern='^(feat|fix)(\([^)]*\))?!?:'

    previous=$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude "v${version}") || return 1
    messages=$(git log "${previous}..HEAD" --format=%B) || return 1
    subjects=$(git log "${previous}..HEAD" --format=%s --reverse) || return 1
    printf '## Breaking changes\n\n'
    while IFS= read -r line; do
        if [[ ${line} == 'BREAKING CHANGE:'* ]]; then
            printf -- '- %s\n' "${line#BREAKING CHANGE: }"
        fi
    done <<<"${messages}"
    printf '\n## Changes\n\n'
    while IFS= read -r line; do
        if [[ ${line} =~ ${subject_pattern} ]]; then
            printf -- '- %s\n' "${line}"
        fi
    done <<<"${subjects}"
}

# publish_tags: Pushes the package tags and creates release notes for the CLI.
# Arguments:
#   Plugin version.
#   CLI version.
publish_tags() {
    local plugin_version="$1"
    local cli_version="$2"
    local tag
    local remote_tag
    local releases
    local notes

    for tag in "eslint-plugin-v${plugin_version}" "v${cli_version}"; do
        if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null 2>&1; then
            git tag "${tag}" || return 1
        fi
        remote_tag=$(git ls-remote --tags origin "refs/tags/${tag}") || return 1
        if [[ -z ${remote_tag} ]]; then
            git push origin "${tag}" || return 1
        fi
    done
    releases=$(gh release list --limit 1000 --json tagName) || return 1
    if ! jq -e --arg tag "v${cli_version}" 'any(.[]; .tagName == $tag)' <<<"${releases}" >/dev/null; then
        notes=$(release_notes "${cli_version}")
        gh release create "v${cli_version}" --verify-tag --title "v${cli_version}" --notes "${notes}" --generate-notes || return 1
    fi
}
