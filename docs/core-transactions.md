# Portable focus transactions (ITAR-0036–0044)

## Records (ITAR-0036)

Strong request, effect and surface-lifetime tokens identify value-only work.
Reveal, focus and cancellation have individual tokens and outcome kinds;
unrealized targets have no mount generation. Effect and focus-notification
channels are distinct and draining them performs no platform operation.
The owner thread and host retain views, callbacks, clocks and timers.
`core.transaction_records` verifies identity separation and independent drains.

## Entry (ITAR-0037)

`begin` checks proposal policy, revision, surface, source and current target;
`requestFocus` shares eligibility and authority checks but permits an explicit key
from unknown/absent host focus. Scope activity is never changed implicitly.
Starting queues a movement effect without changing focus/history or notifying.
`core.transaction_start` covers stale proposals, mounted/unmounted keys, missing
keys and inactive scopes. The entry API and shared fixtures remain below the per-ticket ceiling.

## Realization (ITAR-0038)

Dispatch calls `issue` immediately before invoking the host. A reveal's matching
request/item/dataset and live mount must be reported by `realize`; estimated,
missing, dirty or clipped geometry cannot advance it. Completion of reveal is
separate from mount arrival. Fresh committed geometry then allows exactly one
focus effect. `core.transaction_reveal` covers 19→20, mismatches and clipped views.

## Confirmation (ITAR-0039)

Only issued, matching tokens accept operation outcomes; acceptance without actual
focus evidence stays pending. Current host observations update input/history or
the separate accessibility channel. Correlated target callbacks complete their
request once; repeated callback/outcome evidence produces one focus notification.
`core.transaction_outcome` uses an ordered, guarded fake-host inbox for both
callback/return orders, rejected outcomes, unissued/wrong-kind/duplicate tokens
and accepted-without-focus. The adapter must verify delayed observations against
current host state before submitting them; this core harness does not run a host.

## Cancellation and invalidation (ITAR-0040)

Cancellation is request-specific and idempotent. Undispatched work is discarded;
issued work receives an exact-operation cancellation token, still valid after
replacement or mount loss. Cancelled/already-finished releases that operation;
not-cancellable retains it for later completion. A late actual focus change is
observed without completing revoked intent. `apply` and `observeAvailability`
revalidate related logical changes; borrowed-State users call `synchronize` after
mutations. Disposal revokes the lifetime and clears value bookkeeping; the host
teardown contract releases native operations. `core.transaction_cancel` verifies
replacement safety, late focus, removal cleanup, queued cancellation and reorder.

## Host time (ITAR-0041)

`advanceTo` consumes monotonic host units and rejects backward time without a
state change. Expiry occurs at `now >= original deadline` through cancellation;
`nextDeadline` returns the active wakeup or none. Equal timestamps are processed
in caller order: a confirmation submitted before the expiry event can complete,
while expiry submitted first revokes intent. No engine clock/thread or sleep is
used. `core.transaction_time` tests both phases and completion at the boundary.

## Pending input (ITAR-0042)

Same-direction input joins the current authorized request and keeps its destination
and original deadline. Release clears held input without cancelling movement.
Direction changes and explicit keys revoke prior intent; directions resolve from
observed focus, with no speculative cursor or future movement count. Loading
completion never starts queued steps. `core.transaction_input` repeats 1,000
presses in each phase, reverses at the real source, supersedes with an explicit
key, releases held input and resolves the next move from confirmed focus.

## Bounds and resources (ITAR-0043)

Configured operation/effect/notification capacities bound retained value records.
Entry exhaustion rejects work before allocating identity; cleanup/notification
saturation returns or exposes `resyncRequired`, stops new movement dispatch and
preserves issued-operation/current-focus evidence. The host must resynchronize
and recreate the owner with a fresh lifetime, releasing old operations through
its teardown contract. Construction and caller-owned output copies can allocate;
failed output copies leave the internal queue intact. No retired-request list is
kept. IDs exhaust without reuse, including test-configured ceilings.

`issue` waits while an issued movement occupies the same declared resource.
Not-cancellable retains that lock; newer intent can expire. Terminal completion,
matching completed realization or cancellation releases the operation and stale
cleanup tokens. `core.transaction_bounds` covers resource contention, expiry,
all three capacity limits, ID exhaustion, 1,000 replacements and disposal.
The cohesive limits/resource slice stays below the per-ticket ceiling.

## Internal replay (ITAR-0044)

`core.transaction_replay` defines test-local fixture version 1 with configuration,
initial state and ordered protocol-value events: batches, directional input,
release, key/cancel commands, issue/outcome/realization, host focus, availability
and host time. Effect indices refer to earlier emitted tokens. Unsupported fixture
versions fail explicitly. Each replay checks declared decisions and compares all
decisions, IDs/effect order, notifications and final state across two executions.

The loading/cancellation fixture realizes item 20, cancels its issued focus,
blocks a replacement on that resource, then adopts the cancelled operation's
late real focus without success. The rejected-batch fixture records geometry
invalidation and mount loss separately; rejecting revival of the detached mount
preserves both facts and the host's unmanaged focus. No core replay reproduces
renderer scheduling, native focus APIs, animations, styles or reader speech.
