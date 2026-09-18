---
layer: prose
preset: prose
title: Documentation Review
---

# Documentation Review

The review passes an agent runs over changed documentation before the checks of the repository, and the
definition of done.

## Review documentation systematically

Review from the reader's perspective, not only line by line.

### Factual review

- Does every claim match the implementation or authoritative source?
- Are commands, flags, fields, labels, and outputs exact?
- Are defaults and supported versions current?
- Are permissions accurate?
- Are limitations visible?
- Are examples valid and safe?
- Are future claims avoided or properly scoped?

### Reader-goal review

- Is the intended reader clear?
- Can the reader decide whether the project fits?
- Can the reader reach the first useful result?
- Are prerequisites visible before the procedure?
- Does each task have one outcome?
- Can the reader tell whether a step is required, optional, or recommended?
- Is the expected result clear?
- Is there a recovery path for risky work?

### Structure review

- Does the page use the correct topic type?
- Does information move from broad to specific?
- Is the README useful without the advanced guide?
- Is `ADVANCED.md` justified by coherent specialist content?
- Does every heading describe its content?
- Are heading levels sequential?
- Is the contents list accurate?
- Is repeated content owned in one canonical place?

### Language review

- Is the voice direct, concise, and precise?
- Does each sentence add information?
- Is active voice used where the actor matters?
- Are pronouns unambiguous?
- Are idioms, noun stacks, and nominalizations removed?
- Are sausage sentences split into structured, related claims?
- Are terms and capitalization consistent?
- Are acronyms expanded where needed?
- Are dates and numbers unambiguous?
- Are marketing and judgment words removed?
- Does the page describe present behavior?

### Markdown review

- Is there exactly one H1 or one generated title?
- Does the document title use title case while lower-level headings use sentence case?
- Are blank lines present around blocks?
- Do code fences name a language?
- Are lists parallel and consistently punctuated?
- Are tables genuinely tabular?
- Are links descriptive and durable?
- Is HTML necessary and supported?
- Are line wraps readable in source?

### Accessibility review

- Is essential meaning present in text?
- Do images have useful alt text?
- Are decorative images marked intentionally?
- Do headings expose the structure?
- Do link labels make sense out of context?
- Do tables have headers and complete cells?
- Is color never the sole distinction?
- Are keyboard shortcuts formatted consistently?
- Can the procedure work without relying on element position?

### Security and privacy review

- Are credentials and personal data absent?
- Are sample URLs and accounts fictional?
- Are screenshots sanitized?
- Do examples use least privilege?
- Are destructive effects explained before commands?
- Are internal details omitted from public errors?
- Are restricted links identified?
- Is reused material properly licensed and attributed?
- Are legal and policy documents using their approved source?

### Maintenance review

- Does the content have a clear owner?
- Can volatile values be reduced or generated?
- Are important examples reusable or checkable?
- Are external links authoritative?
- Will a heading change break known anchors?
- Are screenshots and diagrams stored locally and editable?
- Does the documentation avoid unnecessary duplication?

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

- The content has a clear owner and audience.
- The chosen document and topic type fit the reader's goal.
- Every claim is grounded in an authoritative source.
- The README supports evaluation and normal use.
- An advanced guide exists only when specialist depth justifies it.
- Required prerequisites, permissions, limits, and risks are visible.
- Procedures are complete and ordered.
- Examples are valid, safe, and appropriately scoped.
- Markdown is semantic, portable, and readable in source.
- Links are descriptive and durable.
- Images and diagrams add meaning and have accessible alternatives.
- Secrets and personal information are absent.
- The content describes the present state.
- Related documentation remains consistent.
- No stale, duplicated, or placeholder content remains.

The final standard is practical: a reader can understand the project, decide
whether it fits, complete the documented goal safely, and find deeper
information without inspecting implementation source.

Document templates for a README, an advanced guide, a task, a concept, a reference, a
troubleshooting topic, an API endpoint, and release notes ship under `templates/docs/`. Start
from the template, remove sections that do not apply, and never publish an empty heading,
placeholder prose, or a checklist as content.
