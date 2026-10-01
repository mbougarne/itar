# Repository Agent Instructions

Before changing code or documentation, read and follow
[docs/AGENTIC_RULES.md](docs/AGENTIC_RULES.md).

## Project direction

Itar is a focus-management library for React Native TV and set-top-box apps,
backed by an independent C++20 engine. Ownership, lifetime, data locality,
predictable resource use, and explicit platform boundaries guide the design.
Norigin is inspiration for capabilities, not an implementation to translate.

Android host behavior uses Kotlin/JNI. Apple TV host behavior uses Swift, with
minimal Objective-C++ glue where React Native integration requires it. Native
focus styles and accessibility are required throughout implementation and
validation. Other runtimes require evidence before support is claimed.

## Accepted architecture

[architecture](tickets/docs/architecture.md) is **accepted and frozen** as of
September 30, 2026. Do not modify it, including for cleanup, implementation
progress, probe results, or resolution of an open choice.

- Read the relevant architecture contracts before implementing a ticket.
- Resolve explicitly open choices through their stated probes and tests.
  Record results in the ticket or a separate decision note linked from it.
  Choices within the accepted requirements do not require reopening the
  architecture or requesting approval solely because they were left open.
- Supplementary notes and tickets must not silently supersede the baseline.
  If evidence conflicts with an accepted requirement, report the conflict and
  pause the affected implementation. Continue work that is unaffected.
- Acceptance does not turn illustrative APIs into fixed signatures or establish
  benchmark results, device behavior, or verified platform support.
- Treat [platform research](tickets/docs/platform-research.md) as dated supporting
  evidence. Verify the selected runtime and toolchain when implementing it.

## Ticket workflow

- Start from [tickets/backlog.md](tickets/backlog.md) and the full ticket in its
  phase file. Follow dependencies, not ticket numbers or phase order.
- Keep each implementation independently reviewable: target about 250 authored
  changed lines, including code, tests, configuration, and documentation. Up to
  500 is allowed with a scope explanation; split before exceeding that ceiling.
  Follow the backlog's rules for generated changes and ticket splitting.
- Use only **Backlog**, **In Progress**, and **Done**. Update the full ticket and
  matching index row together. Mark Done only when acceptance has evidence.
- Preserve ticket IDs and keep at most 10 full tickets per phase/feature file.
  The backlog is the master index and lists every ticket.

## Working in this repository

Inspect current files and Git state before editing. Preserve unrelated changes
and staged work. Make only the requested, coherent change; do not create
speculative scaffolding, dependencies, or unrelated refactors.

Run the checks relevant to the change and report what was actually verified.
Keep missing tools, device access, and unrun acceptance explicit. Local notes or
previous conversations do not substitute for current repository evidence.

## Local conversation continuity

This workspace maintains local, ignored AI collaboration records in `.agents/`:

- Read `.agents/conversations/history.json` and the newest relevant file in
  `.agents/conversations/` before continuing an existing task.
- After every user message, create one
  timestamped Markdown record in `.agents/conversations/` using the format
  `YYYY-MM-DD-HH-MM-SS_<uuid>.md`.
- Create a matching, concise educational trace in `.agents/researches/` for
  every user message. It explains the observable AI workflow for that request,
  not private reasoning. It must teach one concrete underlying AI/ML or
  technical concept relevant to the request (for example retrieval, attention,
  tokenization, generation, verification, or tool grounding), rather than
  paraphrasing the conversation record. Where the concept uses quantitative
  mechanics, include a small worked numerical example (vectors, weights, dot
  products, matrix multiplication, probabilities, or comparable concrete
  values) and connect each term back to the task. Use the same filename and
  UUID as its conversation record. Keep it to 100 lines or fewer.
- Append one sanitized interaction object to `.agents/conversations/history.json`
  with the date, UUID, sequence, request interpretation, response summary,
  approach, changed files, and verification.
- Never put secrets, tokens, passwords, private keys, full credentials,
  personal data, or raw production logs in `.agents/`.

These records are local continuity aids, not an authoritative specification.
The user request, tracked repository documents, and current code remain the
source of truth.
