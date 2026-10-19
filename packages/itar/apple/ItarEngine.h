#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
#define ITAR_NOEXCEPT noexcept
extern "C" {
#else
#define ITAR_NOEXCEPT
#endif

// Private native ABI, versioned with this package. One serialized owner thread.
// The caller owns create's result. Dispose revokes; destroy frees exactly once
// after calls unwind. No calls may use a destroyed pointer. Null destroy is safe.
// All input buffers are borrowed only for the call and copied before publication.
// Output records contain values only. No C++ objects or callbacks cross C.
typedef struct ItarEngine ItarEngine;
typedef enum {
  ITAR_OK, ITAR_INVALID, ITAR_WRONG_THREAD, ITAR_STALE_LIFETIME,
  ITAR_DISPOSED, ITAR_RESOURCE, ITAR_INTERNAL, ITAR_BUFFER_TOO_SMALL
} ItarCallStatus;
typedef struct { uint32_t slot, generation; } ItarNode;
typedef struct { const uint8_t *bytes; size_t count; } ItarBytes;
typedef struct { double x, y, width, height; } ItarRect;
typedef struct {
  uint64_t surface, mount, layout;
  ItarRect bounds;
  int32_t state; // unavailable, dirty, measured, hidden, clipped = 0..4
} ItarGeometry;
typedef struct {
  int32_t order;
  uint8_t scope, active, enabled, mounted;
  uint64_t mount;
  ItarGeometry geometry;
  ItarNode overrides[4]; // left, right, up, down
  int32_t layout, boundary; // spatial/row/column; stop/wrap/parent = 0..2
  uint8_t rtl, trap, entry_ready;
} ItarRecord;
typedef struct {
  int32_t kind; // insert, update, replace, erase = 0..3
  ItarBytes key, parent;
  ItarNode expected;
  ItarRecord record;
  uint8_t has_preferred;
  ItarBytes preferred; // present + empty clears; absent preserves
} ItarMutation;
typedef struct {
  ItarCallStatus call;
  int32_t code; // BatchStatus ordinal, valid = 0
  uint64_t revision;
  size_t operation; // SIZE_MAX when no operation is implicated
} ItarBatchResult;
typedef struct {
  int32_t kind; // managed, unmanaged, absent, unknown = 0..3
  ItarNode node;
  uint64_t mount;
} ItarFocus;
typedef struct {
  uint64_t lifetime, request, effect;
  int32_t kind; // reveal, focus, cancel = 0..2
} ItarToken;
typedef struct {
  ItarToken token;
  uint64_t surface;
  ItarNode target;
  uint64_t mount, dataset, resource; // zero mount means unrealized
  uint8_t has_cancels;
  ItarToken cancels;
} ItarEffect;
typedef struct {
  ItarCallStatus call;
  int32_t code; // RequestStatus ordinal; accepted never implies confirmation
  uint64_t request;
} ItarRequestResult;
enum {
  ITAR_REQUEST_STARTED = 0, ITAR_REQUEST_CONFIRMED = 8,
  ITAR_REQUEST_RESYNC = 13, ITAR_REQUEST_ISSUED = 15,
  ITAR_REQUEST_WAITING = 16
};
typedef struct {
  int32_t channel; // input = 0, accessibility = 1
  ItarFocus focus;
  uint64_t confirmed_request; // zero means external/unconfirmed observation
} ItarNotification;
typedef struct {
  ItarCallStatus call;
  uint64_t revision, deadline, active_request; // zero deadline/request means no pending request
  ItarFocus input, accessibility;
  uint8_t resync_required;
} ItarSnapshot;

// Capacity 1..4096, key size <=512 bytes, batch size <=2*capacity.
ItarEngine *itar_engine_create(uint64_t surface, uint64_t lifetime, uint32_t capacity,
                               ItarCallStatus *status) ITAR_NOEXCEPT;
ItarCallStatus itar_engine_dispose(ItarEngine *, uint64_t lifetime) ITAR_NOEXCEPT;
ItarCallStatus itar_engine_destroy(ItarEngine *) ITAR_NOEXCEPT;
ItarSnapshot itar_engine_snapshot(ItarEngine *, uint64_t lifetime) ITAR_NOEXCEPT;
ItarBatchResult itar_engine_apply(ItarEngine *, uint64_t lifetime, uint64_t revision,
    const ItarMutation *, size_t count) ITAR_NOEXCEPT;
ItarCallStatus itar_engine_find(ItarEngine *, uint64_t lifetime, ItarBytes key,
                               ItarNode *output) ITAR_NOEXCEPT;
// Host facts use an independent channel and cannot be rolled back by a batch.
ItarRequestResult itar_engine_observe_focus(ItarEngine *, uint64_t lifetime,
    int32_t channel, ItarFocus, uint8_t has_correlation, ItarToken) ITAR_NOEXCEPT;
ItarCallStatus itar_engine_invalidate(ItarEngine *, uint64_t lifetime, ItarNode,
    uint64_t mount, int32_t kind, uint64_t through, int32_t *code) ITAR_NOEXCEPT;
// Explicit focus only. UIKit retains directional ownership in this increment.
// owner: engine/text/native_control/accessibility/system = 0..4.
ItarRequestResult itar_engine_request_focus(ItarEngine *, uint64_t lifetime,
    ItarBytes key, ItarNode authority, int32_t owner, uint64_t deadline,
    uint64_t dataset) ITAR_NOEXCEPT;
ItarRequestResult itar_engine_restore_scope(ItarEngine *, uint64_t lifetime,
    ItarBytes scope_key, uint64_t deadline, uint64_t dataset) ITAR_NOEXCEPT;
ItarRequestResult itar_engine_issue(ItarEngine *, uint64_t lifetime, ItarToken) ITAR_NOEXCEPT;
// Outcome: accepted/rejected/completed/cancelled/already_finished/not_cancellable = 0..5.
// Real host focus is observed separately, including late callbacks after cancel.
ItarRequestResult itar_engine_complete(ItarEngine *, uint64_t lifetime,
    ItarToken, int32_t outcome) ITAR_NOEXCEPT;
ItarRequestResult itar_engine_cancel(ItarEngine *, uint64_t lifetime, uint64_t request) ITAR_NOEXCEPT;
// Host-supplied monotonic units, matching request deadlines. No timer/polling here.
ItarRequestResult itar_engine_advance(ItarEngine *, uint64_t lifetime, uint64_t now) ITAR_NOEXCEPT;
// One bounded, value-only opener context per surface. Capture returns token zero
// when there is no eligible observed opener. Restore consumes the exact token,
// respects host reassignment, and lets the core select deletion recovery.
ItarCallStatus itar_engine_capture_restoration(ItarEngine *, uint64_t lifetime, uint64_t *token) ITAR_NOEXCEPT;
ItarRequestResult itar_engine_restore(ItarEngine *, uint64_t lifetime, uint64_t token,
    int32_t owner, uint64_t deadline, uint64_t dataset) ITAR_NOEXCEPT;
// Exactly 32 records of capacity suffice for each bounded channel. Insufficient
// capacity returns BUFFER_TOO_SMALL without consuming values; count is zeroed.
ItarCallStatus itar_engine_effects(ItarEngine *, uint64_t lifetime,
    ItarEffect *output, size_t capacity, size_t *count) ITAR_NOEXCEPT;
ItarCallStatus itar_engine_notifications(ItarEngine *, uint64_t lifetime,
    ItarNotification *output, size_t capacity, size_t *count) ITAR_NOEXCEPT;

#ifdef __cplusplus
}
#endif
#undef ITAR_NOEXCEPT
