/* global document, globalThis */
'use strict';

(() => {
  const model = globalThis.OccoTimelineModel;
  const picker = document.getElementById('file');
  const list = document.getElementById('events');
  const details = document.getElementById('details');
  const status = document.getElementById('status');
  let recording;
  let reading = 0;

  function select() {
    details.replaceChildren();

    if (!recording) return;

    for (const [label, value] of model.eventDetails(
      recording,
      list.selectedIndex,
    )) {
      const name = document.createElement('dt');
      const field = document.createElement('dd');

      name.textContent = label;
      field.textContent = value;
      details.append(name, field);
    }
  }

  picker.addEventListener('change', async () => {
    const token = ++reading;
    const file = picker.files[0];

    recording = undefined;
    list.replaceChildren();
    list.disabled = true;
    select();

    if (!file) return;

    try {
      if (file.size > model.maxBytes) throw new Error('File exceeds 16 MB.');

      const text = await file.text();

      if (token !== reading) return;

      recording = model.parseRecording(text);

      const items = document.createDocumentFragment();
      let marked = -1;

      recording.events.forEach((event, index) => {
        const item = document.createElement('option');

        item.textContent = model.eventTitle(event);
        items.append(item);

        if (event.kind === 'marker' && event.detail === 'incident')
          marked = index;
      });

      list.append(items);
      list.disabled = !recording.events.length;

      list.selectedIndex =
        marked >= 0 ? marked : Math.max(0, recording.events.length - 1);

      status.textContent =
        file.name + ' · ' + model.recordingSummary(recording);

      select();

      if (!list.disabled) list.focus();
    } catch (error) {
      if (token === reading) status.textContent = error.message;
    }
  });

  list.addEventListener('change', select);
})();
