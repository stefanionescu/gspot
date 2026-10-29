#!/usr/bin/env bash

# package_field: Prints a field from a package manifest.
# Arguments:
#   Package folder.
#   Field name.
package_field() {
    local folder="$1"
    local field="$2"
    local value

    value=$(npm pkg get "${field}" --prefix "${folder}") || return 1
    jq -er 'select(type == "string" and length > 0)' <<<"${value}"
}

# registry_version: Prints a published version, or nothing when npm has no such version.
# Arguments:
#   Package name and version or tag.
registry_version() {
    local spec="$1"
    local output
    local error_code

    if output=$(npm view "${spec}" version --json); then
        jq -er 'select(type == "string" and length > 0)' <<<"${output}"
    else
        error_code=$(jq -r '.error.code // empty' <<<"${output}") || return 1
        if [[ ${error_code} != E404 ]]; then
            printf 'Cannot read npm version for %s.\n' "${spec}" >&2
            return 1
        fi
    fi
}

# publish_package: Publishes a missing version and waits until npm serves it.
# Arguments:
#   Package folder.
#   Package version.
publish_package() {
    local folder="$1"
    local version="$2"
    local spec
    local published
    local poll

    spec="$(package_field "${folder}" name)@${version}"
    published=$(registry_version "${spec}")
    if [[ -z ${published} ]]; then
        npm publish "./${folder}" || return 1
    fi
    for ((poll = 0; poll < 30; poll++)); do
        published=$(registry_version "${spec}")
        if [[ ${published} == "${version}" ]]; then
            return 0
        fi
        if ((poll < 29)); then
            sleep 10
        fi
    done
    printf 'npm does not serve %s yet. Run the release again.\n' "${spec}" >&2
    return 1
}
