/* global globalThis */
'use strict';

// One read-only model for Metro, Node tests and the offline file:// viewer.
const maxBytes = 16 * 1024 * 1024;
const maxEvents = 8192;

const textFields = [
  'surface',
  'request',
  'move',
  'target',
  'mount',
  'channel',
  'direction',
  'owner',
  'detail',
  'effect',
];

const integer = value => Number.isSafeInteger(value) && value >= 0;

// Native hosts share coarse roles. Recordings never need an element's text.
const nativeRoles = new Set([
  'button',
  'text input',
  'text',
  'image',
  'image button',
  'switch',
  'checkbox',
  'radio button',
  'slider',
  'list',
  'grid',
  'horizontal scroll view',
  'vertical scroll view',
  'container',
  'view',
  'unknown',
]);

function validNativeDestination(event) {
  const destination = event.nativeDestination;

  if (destination === undefined) return true;

  if (
    event.kind !== 'observation' ||
    event.detail !== 'callback: unmanaged' ||
    !event.channel ||
    !event.surface ||
    event.target != null ||
    event.mount != null ||
    !nativeRoles.has(destination?.role)
  ) {
    return false;
  }

  const bounds = destination.bounds;

  if (bounds === undefined) return true;

  if (!bounds) return false;

  const { left, top, right, bottom } = bounds;

  return (
    [left, top, right, bottom].every(
      edge =>
        Number.isInteger(edge) && edge >= -2147483648 && edge <= 2147483647,
    ) &&
    right > left &&
    bottom > top
  );
}

function parseRecording(text) {
  if (typeof text !== 'string' || text.length > maxBytes) {
    throw new Error('Choose an Occo JSON recording smaller than 16 MB.');
  }

  const recording = JSON.parse(text);

  if (recording?.format !== 'occo' || recording.version !== 1) {
    throw new Error('This viewer opens Occo version 1 recordings.');
  }

  const { capacity, dropped, events } = recording;

  if (
    !integer(dropped) ||
    !integer(capacity) ||
    capacity === 0 ||
    !Array.isArray(events) ||
    events.length > Math.min(capacity, maxEvents)
  ) {
    throw new Error('Invalid recording capacity, dropped count or event list.');
  }

  let seq = 0;
  let ms = 0;

  for (const event of events) {
    if (
      !event ||
      !integer(event.seq) ||
      event.seq <= seq ||
      !integer(event.ms) ||
      event.ms < ms ||
      typeof event.kind !== 'string' ||
      !event.kind ||
      textFields.some(
        key => event[key] != null && typeof event[key] !== 'string',
      ) ||
      !validNativeDestination(event) ||
      (event.channel != null &&
        !['input', 'accessibility'].includes(event.channel))
    ) {
      throw new Error('Invalid event fields, time or sequence order.');
    }

    seq = event.seq;
    ms = event.ms;
  }

  return recording;
}

function recordingSummary(recording) {
  const fields = [
    recording.events.length + ' events',
    recording.dropped + ' dropped',
  ];

  const device = recording.device;

  if (typeof device?.model === 'string') fields.push(device.model);

  if (typeof device?.android === 'string')
    fields.push('Android ' + device.android);

  if (typeof device?.tvos === 'string') fields.push('tvOS ' + device.tvos);

  if (typeof device?.voiceOverAtStart === 'boolean')
    fields.push(
      'VoiceOver ' + (device.voiceOverAtStart ? 'on' : 'off') + ' at start',
    );

  if (typeof device?.accessibilityEnabledAtStart === 'boolean') {
    fields.push(
      'accessibility ' +
        (device.accessibilityEnabledAtStart ? 'on' : 'off') +
        ' at start',
    );
  }

  if (typeof device?.touchExplorationAtStart === 'boolean') {
    fields.push(
      'touch exploration ' +
        (device.touchExplorationAtStart ? 'on' : 'off') +
        ' at start',
    );
  }

  return fields.join(' · ');
}

function eventTitle(event) {
  const description = [
    event.direction,
    event.channel,
    event.detail,
    event.nativeDestination?.role,
  ].filter(Boolean);

  return (
    '#' +
    event.seq +
    '  +' +
    event.ms +
    ' ms  ' +
    [event.kind, ...description].join(' · ')
  );
}

function placement(event) {
  if (!event) return 'not observed';

  const target = event.target || event.detail || 'not observed';

  if (event.nativeDestination) {
    const { role, bounds } = event.nativeDestination;

    const screen = bounds
      ? `screen bounds (${bounds.left}, ${bounds.top})–(${bounds.right}, ${bounds.bottom}) px`
      : 'screen bounds not recorded';

    return `${target} · native role ${role} · ${screen}`;
  }

  if (event.kind === 'observation' && event.detail === 'callback: unmanaged') {
    return target + ' · native destination not recorded';
  }

  return event.mount ? target + ' (mount ' + event.mount + ')' : target;
}

// Input is recorded before dispatch. Include subsequent decisions only when the
// same move ID was passed to the engine; show their sequence numbers explicitly.
function linkedDecisions(events, input) {
  const requests = new Map();
  const steps = [];
  let received;

  for (const event of events) {
    if (
      !input.move ||
      event.move !== input.move ||
      !event.surface ||
      (input.surface && event.surface !== input.surface)
    )
      continue;

    if (event.kind === 'input') received = event;

    if (event.kind === 'request' && event.request) {
      const id = JSON.stringify([event.surface, event.request]);

      if (!requests.has(id)) requests.set(id, { event });
    }
  }

  for (const event of events) {
    if (!event.request || !event.surface) continue;

    const linked = requests.get(JSON.stringify([event.surface, event.request]));

    if (!linked) continue;

    if (
      !linked.intent &&
      event.target &&
      (event.kind === 'request' || event.kind === 'effect')
    ) {
      linked.intent = event;
    }

    if (
      event.kind === 'effect' ||
      event.kind === 'host' ||
      event.kind === 'observation' ||
      (event.kind === 'request' &&
        !['started', 'unchanged'].includes(event.detail))
    ) {
      steps.push(
        '#' +
          event.seq +
          ' ' +
          (event.kind === 'observation'
            ? event.channel + ' observation'
            : event.detail || event.kind),
      );
    }
  }

  return { received, steps, requests: Array.from(requests.values()) };
}

function shortList(entries) {
  if (entries.length <= 8) return entries.join(' · ');

  return [
    ...entries.slice(0, 4),
    '… ' + (entries.length - 7) + ' more …',
    ...entries.slice(-3),
  ].join(' · ');
}

// These are subsequent events, not inferred consequences of the key. A missing
// sequence could hide the next independent press, so never look across a gap.
function followingFacts(events, index, linked) {
  const selected = events[index];
  const surface = selected.surface || linked.received?.surface;
  const observed = {};
  const mounts = [];
  let activation;

  const intended = new Set(
    linked.requests
      .filter(({ intent }) => intent)
      .map(({ intent }) => JSON.stringify([intent.surface, intent.target])),
  );

  let gap = false;

  for (let i = index + 1; i < events.length; i++) {
    const event = events[i];

    if (event.seq !== events[i - 1].seq + 1) {
      gap = true;

      break;
    }

    if (
      event.kind === 'input' &&
      (!event.move || event.move !== selected.move) &&
      !event.detail?.endsWith(' up')
    )
      break;

    if (!event.surface || (surface && event.surface !== surface)) continue;

    const fact =
      '#' +
      event.seq +
      ' ' +
      placement(event) +
      (surface ? '' : ' · surface ' + event.surface);

    if (
      event.kind === 'observation' &&
      event.channel &&
      !observed[event.channel]
    ) {
      observed[event.channel] = fact;
    }

    if (!activation && event.kind === 'activation') activation = fact;

    if (
      (event.kind === 'mount' || event.kind === 'unmount') &&
      event.target &&
      intended.has(JSON.stringify([event.surface, event.target]))
    ) {
      mounts.push(
        '#' + event.seq + ' ' + event.kind + ' ' + (event.mount || 'unknown'),
      );
    }
  }

  const missing = gap ? 'not observed before recording gap' : 'not observed';

  return [
    ['Next input observation', observed.input || missing],
    ['Next accessibility observation', observed.accessibility || missing],
    ...(selected.direction === 'select'
      ? [['Next observed activation', activation || missing]]
      : []),
    ...(mounts.length
      ? [['Target mounts in interval', shortList(mounts)]]
      : []),
  ];
}

// Only explicit identifiers tie an input to a transaction. The two focus
// rows are running observations on this surface, never inferred effects.
function eventDetails(recording, index) {
  const selected = recording.events[index];

  if (!selected) return [];

  const requestId = selected.request;
  let moveId = selected.move;

  if (!moveId && requestId && selected.surface) {
    for (let i = index; i >= 0; i--) {
      const event = recording.events[i];

      if (
        event.surface === selected.surface &&
        event.request === requestId &&
        event.move
      ) {
        moveId = event.move;

        break;
      }
    }
  }

  let windowInput;
  let keyInput;
  let host;
  let owner;
  let intended;
  let inputFocus;
  let accessibilityFocus;

  for (let i = 0; i <= index; i++) {
    const event = recording.events[i];
    const sameMove = moveId && event.move === moveId;

    if (
      event.kind === 'input' &&
      !event.surface &&
      (sameMove || event === selected)
    ) {
      windowInput = event;
    }

    if (
      event.kind === 'observation' &&
      event.surface &&
      (!selected.surface || event.surface === selected.surface)
    ) {
      if (event.channel === 'input') inputFocus = event;

      if (event.channel === 'accessibility') accessibilityFocus = event;
    }

    if (!selected.surface || event.surface !== selected.surface) continue;

    const sameRequest = requestId && event.request === requestId;
    // A single key can start more than one request. An explicit request is narrower.
    const related = requestId ? sameRequest : sameMove;

    if (event.kind === 'input' && (sameMove || event === selected)) {
      keyInput = event;

      if (event.owner) owner = event.owner;
    }

    if (
      (related || event === selected) &&
      event.target &&
      (event.kind === 'request' ||
        event.kind === 'effect' ||
        event.kind === 'host')
    ) {
      intended = event;
    }

    if (event.kind === 'host' && (sameRequest || event === selected))
      host = event;
  }

  const linked =
    selected.kind === 'input'
      ? linkedDecisions(recording.events, selected)
      : null;

  if (!keyInput && linked?.received) {
    keyInput = linked.received;
    owner = keyInput.owner;
  }

  const relatedRequests = linked?.requests
    .map(
      ({ event }) =>
        event.request + ' (surface ' + event.surface + ', #' + event.seq + ')',
    )
    .join(', ');

  const linkedTargets = linked?.requests
    .filter(item => item.intent)
    .map(({ intent }) => placement(intent) + ' (#' + intent.seq + ')')
    .join(', ');

  const observed = event =>
    !selected.surface && event
      ? placement(event) + ' · surface ' + event.surface
      : placement(event);

  return [
    ['Time', '+' + selected.ms + ' ms'],
    ['Surface', selected.surface || 'not recorded'],
    [
      'Window input',
      windowInput ? windowInput.direction || 'observed' : 'not observed',
    ],
    [
      'Itar input',
      keyInput ? keyInput.direction || 'observed' : 'not observed',
    ],
    ['Navigation owner', selected.owner || owner || 'unknown'],
    ['Move', moveId || 'not linked'],
    ['Request', requestId || relatedRequests || 'not linked'],
    ['Effect', selected.effect || 'not linked'],
    ['Intended target', linkedTargets || placement(intended)],
    ...(linked
      ? [
          ['Linked request steps', shortList(linked.steps) || 'not observed'],
          ...followingFacts(recording.events, index, linked),
        ]
      : [['Host response', host?.detail || 'not observed']]),
    ['Last input focus', observed(inputFocus)],
    ['Last accessibility focus', observed(accessibilityFocus)],
    [
      'Event target',
      placement(
        selected.target || selected.mount || selected.kind === 'observation'
          ? selected
          : null,
      ),
    ],
    ['Event detail', selected.detail || 'not recorded'],
  ];
}

const model = {
  maxBytes,
  parseRecording,
  recordingSummary,
  eventTitle,
  eventDetails,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = model;
} else {
  globalThis.OccoTimelineModel = model;
}
