const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {eventDetails, eventTitle, parseRecording} = require('../apps/probe/occo/timeline');
const sample = readFileSync(join(__dirname, '../apps/probe/occo/synthetic-example.json'), 'utf8');
const frame = (recording, index) => Object.fromEntries(eventDetails(recording, index));

test('Occo reopens the entire ordered export including tied timestamps, both channels and recycled mounts', () => {
  const first = parseRecording(sample);
  const reopened = parseRecording(JSON.stringify(first));
  assert.deepEqual(reopened, first);
  assert.deepEqual(reopened.events.map(e => e.seq), Array.from({length: 17}, (_, i) => i + 1));
  const recorded = JSON.stringify(reopened);
  for (let t = reopened.events.length - 1; t >= 0; t--) frame(reopened, t);
  assert.equal(JSON.stringify(reopened), recorded);
  const mark = frame(reopened, 13);
  assert.equal(mark['Last input focus'], 'card-b (mount 22) · surface 3');
  assert.equal(mark['Last accessibility focus'], 'menu (mount 23) · surface 3');
  assert.equal(frame(reopened, 6)['Event target'], 'card-b (mount 19)');
});

test('Occo connects a host response to its request and received key, without confirming focus', () => {
  const recording = parseRecording(sample);
  const windowKey = frame(recording, 2);
  assert.equal(windowKey.Request, '12 (surface 3, #5)');
  assert.equal(windowKey['Intended target'], 'card-b (#6)');
  assert.equal(windowKey['Itar input'], 'down');
  assert.equal(windowKey['Last input focus'], 'card-a (mount 21) · surface 3');
  const response = frame(recording, 9);
  assert.equal(response.Move, '1');
  assert.equal(response['Window input'], 'down');
  assert.equal(response['Itar input'], 'down');
  assert.equal(response['Navigation owner'], 'engine');
  assert.equal(response['Intended target'], 'card-b (mount 22)');
  assert.equal(response['Last input focus'], 'card-a (mount 21)');
  assert.equal(response['Host response'], 'accepted');
  assert.equal(response['Last accessibility focus'], 'not observed');
  assert.equal(frame(recording, 10)['Event detail'], 'cancelled');
  const late = frame(recording, 11);
  assert.equal(late.Request, 'not linked');
  assert.equal(late['Itar input'], 'not observed');
  assert.equal(late['Last input focus'], 'card-b (mount 22)');
});

test('Occo shows absent evidence on a dropped prefix and keeps surface-local request IDs separate', () => {
  const recording = parseRecording(sample);
  const tail = { ...recording, dropped: 8, events: recording.events.slice(8) };
  assert.equal(frame(tail, 1)['Itar input'], 'not observed');
  assert.equal(frame(tail, 1)['Last input focus'], 'not observed');
  const appended = event => frame(
    {...recording, events: [...recording.events, {...event, seq: 18, ms: 70}]},
    recording.events.length,
  );
  const reused = {...recording.events[9], surface: '4'};
  assert.equal(appended(reused).Move, 'not linked');
  const windowOnly = {...recording.events[2], direction: 'down', move: '3'};
  const unhandled = appended(windowOnly);
  assert.equal(unhandled['Window input'], 'down');
  assert.equal(unhandled['Itar input'], 'not observed');
  assert.equal(unhandled['Navigation owner'], 'unknown');
  const host = {...recording.events[3], owner: 'accessibility', direction: 'left', move: '3'};
  const hostMove = appended(host);
  assert.equal(hostMove['Navigation owner'], 'accessibility');
  assert.equal(hostMove['Itar input'], 'left');
  assert.equal(hostMove['Intended target'], 'not observed');
});

test('unmanaged callbacks show their own native role and screen bounds on the observed channel', () => {
  const recording = parseRecording(sample);
  const callback = recording.events[15];
  const location = 'callback: unmanaged · native role horizontal scroll view · screen bounds (96, 300)–(1824, 628) px';
  assert.match(eventTitle(callback), /input · callback: unmanaged · horizontal scroll view/);
  assert.equal(frame(recording, 14)['Next input observation'], '#16 ' + location);
  assert.equal(frame(recording, 14)['Next accessibility observation'], 'not observed');
  assert.equal(frame(recording, 15)['Event target'], location);
  assert.equal(frame(recording, 15)['Last accessibility focus'], 'menu (mount 23)');
  assert.equal(frame(recording, 16)['Last input focus'], location + ' · surface 3');

  const withCallback = event => parseRecording(JSON.stringify({
    ...recording, events: [...recording.events.slice(0, 15), event],
  }));
  const partial = withCallback({...callback, channel: 'accessibility', nativeDestination: {role: 'unknown'}});
  assert.equal(frame(partial, 15)['Last input focus'], 'card-b (mount 22)');
  assert.match(frame(partial, 14)['Next accessibility observation'], /native role unknown · screen bounds not recorded/);
  const {nativeDestination, ...legacyEvent} = callback;
  const legacy = withCallback(legacyEvent);
  assert.match(frame(legacy, 15)['Event target'], /unmanaged · native destination not recorded/);
  const sampled = parseRecording(JSON.stringify({...recording, events: [
    callback, {seq: 17, ms: 60, kind: 'observation', surface: '3', channel: 'input', detail: 'core sample: unmanaged'},
  ]}));
  assert.equal(frame(sampled, 0)['Event target'], location);
  assert.equal(frame(sampled, 1)['Last input focus'], 'core sample: unmanaged');
  assert.equal(frame(sampled, 1)['Event target'], 'core sample: unmanaged');
});

test('optional native destination data accepts offscreen bounds and rejects invalid rectangles or associations', () => {
  const recording = parseRecording(sample);
  const event = recording.events[15];
  const parse = fields => parseRecording(JSON.stringify({...recording, events: [{...event, ...fields}]}));
  const bounds = {left: -10, top: -4, right: 80, bottom: 127};
  const nativeDestination = {role: 'button', bounds};
  assert.deepEqual(parse({nativeDestination}).events[0].nativeDestination, nativeDestination);
  for (const invalid of [
    {nativeDestination: null}, {nativeDestination: {role: 'unexpected'}},
    {kind: 'host'}, {channel: undefined}, {surface: undefined}, {target: 'managed'}, {mount: '91'},
    {detail: 'callback: absent'}, {detail: 'callback: unknown'}, {detail: 'callback: cleared'},
    {detail: 'core sample: unmanaged'}, {detail: undefined},
    ...[{left: '0'}, {bottom: 1.5}, {right: undefined}, {top: 127}, {left: 90}, {right: 2 ** 31}]
      .map(edges => ({nativeDestination: {role: 'view', bounds: {...bounds, ...edges}}})),
  ]) {
    assert.throws(() => parse(invalid));
  }
});

test('Occo rejects unsupported, oversized, malformed and reordered files before rendering them', () => {
  const file = parseRecording(sample);
  const bad = [null, {...file, version: 2}, {...file, capacity: 1}, {...file, dropped: -1},
    {...file, events: file.events.slice().reverse()}, {...file, events: [...file.events, file.events[13]]},
    {...file, events: [{seq: 1, ms: 0, kind: 'host', request: 9007199254740992}]},
    {...file, events: [{seq: 1, ms: 0, kind: 'observation', channel: 'neither'}]}];
  for (const input of bad) assert.throws(() => parseRecording(JSON.stringify(input)));
  assert.throws(() => parseRecording('!'.repeat(16 * 1024 * 1024 + 1)));
});

test('move details separate linked effect and host evidence from the next observations in time', () => {
  const recording = parseRecording(sample);
  const key = frame(recording, 3);
  assert.match(key['Linked request steps'], /#6 reveal collection.*#9 focus.*#10 accepted.*#11 cancelled/);
  assert.doesNotMatch(key['Linked request steps'], /#12|#13/);
  assert.match(key['Target mounts in interval'], /#7 unmount 19.*#8 mount 22/);
  assert.equal(key['Next input observation'], '#12 card-b (mount 22)');
  assert.equal(key['Last input focus'], 'card-a (mount 21)');
  assert.equal(key['Next accessibility observation'], '#13 menu (mount 23)');
  const hosted = [
    {seq:1,ms:0,kind:'input',surface:'7',move:'9',direction:'down',owner:'accessibility',detail:'surface down'},
    {seq:2,ms:1,kind:'observation',surface:'7',channel:'input',target:'title'},
    {seq:3,ms:2,kind:'input',move:'10',detail:'activity up'},
    {seq:4,ms:3,kind:'observation',surface:'7',channel:'accessibility',target:'menu'},
    {seq:5,ms:4,kind:'input',move:'11',detail:'activity down'},
  ];
  const view = events => frame({...recording,events}, 0);
  const owned = view(hosted);
  assert.equal(owned['Linked request steps'], 'not observed');
  assert.equal(owned['Next accessibility observation'], '#4 menu');
  assert.equal(owned['Next input observation'], '#2 title');
  assert.equal(view(hosted.filter(e=>e.seq!==3))['Next accessibility observation'], 'not observed before recording gap');
  assert.equal(view(hosted.map(e=>e.seq===3?{...e,detail:'activity down'}:e))['Next accessibility observation'], 'not observed');
  // A matched core notification carries an explicit request; the preceding native callback does not.
  const confirmed = recording.events.map(e => e.seq===13 ? {...e, request:'12', channel:'input'} : e);
  assert.match(view([{...confirmed[3],seq:1}, ...confirmed.slice(4)])['Linked request steps'], /#13 input observation/);
});
