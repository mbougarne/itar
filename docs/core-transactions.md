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
keys and inactive scopes. This cohesive API/fixture slice exceeds 250 lines but
stays below 500 including local ticket evidence.
