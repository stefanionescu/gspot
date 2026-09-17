---
layer: prose
preset: prose
title: Documentation Review
---

# Documentation Review

The review passes an agent runs over changed documentation before `gspot check`, and the
definition of done.

## Review documentation systematically

Review from the reader's perspective, not only line by line.

### Factual review

- Does every claim match the implementation or authoritative source? `unenforced`
- Are commands, flags, fields, labels, and outputs exact? `unenforced`
- Are defaults and supported versions current? `unenforced`
- Are permissions accurate? `unenforced`
- Are limitations visible? `unenforced`
- Are examples valid and safe? `unenforced`
- Are future claims avoided or properly scoped? `enforced-by: prose/vale gspot.present-state`

### Reader-goal review

- Is the intended reader clear? `unenforced`
- Can the reader decide whether the project fits? `unenforced`
- Can the reader reach the first useful result? `unenforced`
- Are prerequisites visible before the procedure? `unenforced`
- Does each task have one outcome? `unenforced`
- Can the reader tell whether a step is required, optional, or recommended? `unenforced`
- Is the expected result clear? `unenforced`
- Is there a recovery path for risky work? `unenforced`

### Structure review

- Does the page use the correct topic type? `unenforced`
- Does information move from broad to specific? `unenforced`
- Is the README useful without the advanced guide? `unenforced`
- Is `ADVANCED.md` justified by coherent specialist content? `unenforced`
- Does every heading describe its content? `unenforced`
- Are heading levels sequential? `enforced-by: prose/vale gspot.headings`
- Is the contents list accurate? `unenforced`
- Is repeated content owned in one canonical place? `unenforced`

### Language review

- Is the voice direct, concise, and precise? `unenforced`
- Does each sentence add information? `unenforced`
- Is active voice used where the actor matters? `unenforced`
- Are pronouns unambiguous? `unenforced`
- Are idioms, noun stacks, and nominalizations removed? `enforced-by: prose/vale gspot.idioms`
- Are sausage sentences split into structured, related claims? `enforced-by: prose/vale gspot.sentence-length`
- Are terms and capitalization consistent? `unenforced`
- Are acronyms expanded where needed? `enforced-by: prose/vale gspot.acronyms`
- Are dates and numbers unambiguous? `enforced-by: prose/vale gspot.dates`
- Are marketing and judgment words removed? `enforced-by: prose/vale gspot.marketing`
- Does the page describe present behavior? `unenforced`

### Markdown review

- Is there exactly one H1 or one generated title? `enforced-by: prose/vale gspot.headings`
- Does the document title use title case while lower-level headings use sentence case? `enforced-by: prose/vale gspot.headings`
- Are blank lines present around blocks? `enforced-by: markdown/markdownlint`
- Do code fences name a language? `enforced-by: markdown/markdownlint MD040`
- Are lists parallel and consistently punctuated? `unenforced`
- Are tables genuinely tabular? `unenforced`
- Are links descriptive and durable? `unenforced`
- Is HTML necessary and supported? `unenforced`
- Are line wraps readable in source? `unenforced`

### Accessibility review

- Is essential meaning present in text? `unenforced`
- Do images have useful alt text? `enforced-by: prose/vale gspot.alt-text`
- Are decorative images marked intentionally? `enforced-by: prose/vale gspot.symbols`
- Do headings expose the structure? `unenforced`
- Do link labels make sense out of context? `unenforced`
- Do tables have headers and complete cells? `unenforced`
- Is color never the sole distinction? `unenforced`
- Are keyboard shortcuts formatted consistently? `unenforced`
- Can the procedure work without relying on element position? `unenforced`

### Security and privacy review

- Are credentials and personal data absent? `enforced-by: secrets/gitleaks`
- Are sample URLs and accounts fictional? `unenforced`
- Are screenshots sanitized? `unenforced`
- Do examples use least privilege? `unenforced`
- Are destructive effects explained before commands? `unenforced`
- Are internal details omitted from public errors? `unenforced`
- Are restricted links identified? `unenforced`
- Is reused material properly licensed and attributed? `unenforced`
- Are legal and policy documents using their approved source? `unenforced`

### Maintenance review

- Does the content have a clear owner? `unenforced`
- Can volatile values be reduced or generated? `unenforced`
- Are important examples reusable or checkable? `unenforced`
- Are external links authoritative? `unenforced`
- Will a heading change break known anchors? `enforced-by: docs/links`
- Are screenshots and diagrams stored locally and editable? `unenforced`
- Does the documentation avoid unnecessary duplication? `unenforced`

### README checklist

- [ ] The title names the project or component.
- [ ] The title uses title case.
- [ ] The first paragraph states the purpose in one sentence.
- [ ] Essential background appears before specialized terminology.
- [ ] Important limitations appear before adoption or setup.
- [ ] A small runnable example demonstrates normal use.
- [ ] Prerequisites are complete.
- [ ] Installation and setup are complete.
- [ ] Routine commands are easy to find.
- [ ] Normal configuration is documented.
- [ ] The architecture overview is concise.
- [ ] Common failures have direct guidance.
- [ ] Deeper references are linked with descriptive text.
- [ ] Images do not carry essential information alone.
- [ ] Contribution and license information are present or linked.
- [ ] The README remains useful without `ADVANCED.md`.

### Advanced-guide checklist

- [ ] The guide serves a distinct specialist audience.
- [ ] The opening states the assumed README baseline.
- [ ] The content is too substantial for the normal README path.
- [ ] Sections form a coherent advanced subject.
- [ ] Basic setup is not duplicated.
- [ ] Essential caveats remain visible in the README.
- [ ] API, CLI, contribution, security, and history content stay with their
      proper owners.
- [ ] Deep procedures still include their own prerequisites and risks.
- [ ] The guide is linked once with a descriptive summary from the README.

## Definition of done

Documentation work is complete when:

- The content has a clear owner and audience. `unenforced`
- The chosen document and topic type fit the reader's goal. `unenforced`
- Every claim is grounded in an authoritative source. `unenforced`
- The README supports evaluation and normal use. `unenforced`
- An advanced guide exists only when specialist depth justifies it. `unenforced`
- Required prerequisites, permissions, limits, and risks are visible. `unenforced`
- Procedures are complete and ordered. `unenforced`
- Examples are valid, safe, and appropriately scoped. `unenforced`
- Markdown is semantic, portable, and readable in source. `unenforced`
- Links are descriptive and durable. `unenforced`
- Images and diagrams add meaning and have accessible alternatives. `unenforced`
- Secrets and personal information are absent. `enforced-by: secrets/gitleaks`
- The content describes the present state. `enforced-by: prose/vale gspot.present-state`
- Related documentation remains consistent. `unenforced`
- No stale, duplicated, or placeholder content remains. `enforced-by: prose/vale gspot.placeholders`

The final standard is practical: a reader can understand the project, decide
whether it fits, complete the documented goal safely, and find deeper
information without inspecting implementation source.

Document templates for a README, an advanced guide, a task, a concept, a reference, a `unenforced`
troubleshooting topic, an API endpoint, and release notes ship under `templates/docs/`. Start
from the template, remove sections that do not apply, and never publish an empty heading,
placeholder prose, or a checklist as content.
