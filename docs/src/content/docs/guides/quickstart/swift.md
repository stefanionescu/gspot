---
title: "Quickstart: Swift"
description: Set up a Swift project and fix a source finding.
---

Read [Install](/guides/install/) first. This example runs on macOS.

Replace `<version>` with the version you install, such as `0.1.0`.

## Create the project

```shell
mkdir orders-swift && cd orders-swift
git init
swift package init --type library
```

Replace the scaffold source and test with a small calculation and a test that uses it:

```swift title="Sources/orders-swift/orders_swift.swift"
public func total(_ values: [Int]) -> Int {
    values.reduce(0, +)
}
```

```swift title="Tests/orders-swiftTests/orders_swiftTests.swift"
import Testing
@testable import orders_swift

@Test func totalsValues() {
    #expect(total([1, 2, 3]) == 6)
}
```

Commit first. See [Install](/guides/install/):

```shell
git add -A
git commit -m "feat: Create the project"
```

## Set up gspot

Pin gspot in the repository:

```shell
mise use node@24 'npm:@gspothq/cli@<version>'
git add mise.toml
git commit -m "build: Add gspot"
mise exec -- gspot init --yes --configurations swift
```

`init` writes the files and installs nothing. Install the tools and check the setup:

```shell
mise exec -- gspot install
mise exec -- gspot check
```

Fix the findings before you commit.

Format the scaffold's package manifest and rerun the checks:

```shell
mise exec -- gspot check --fix
mise exec -- gspot check
```

```shell
git add -A
git commit -m "chore: Set up gspot"
```

## See a finding

Temporarily replace a source file with this forced cast:

```swift title="Sources/orders-swift/orders_swift.swift"
public func total(_ value: Any) -> Int {
    value as! Int
}
```

Run the source check:

```shell
mise exec -- gspot check --only swift/swiftlint
```

The check exits nonzero and reports:

```text
Sources/orders-swift/orders_swift.swift:2:11  force_cast  Force casts should be avoided
```

Stage the file and run `git commit`. The pre-commit hook refuses the commit and prints the same finding.

## Fix the source

Restore the valid source from the setup commit:

```shell title="Restore the Swift example"
git restore --source=HEAD --staged --worktree -- Sources/orders-swift/orders_swift.swift
mise exec -- gspot check --only swift/swiftlint
```

The same check now reports no forced-cast finding. To check additional conventions, select [level `all`](/guides/overview/#levels) with `mise exec -- gspot set level all`, run the checks, and resolve the findings before committing.

## Continue

Read [Fix findings](/guides/findings/) for individual checks and [Reuse templates](/guides/templates/) to share settings with another repository.
