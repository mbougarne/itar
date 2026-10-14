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
