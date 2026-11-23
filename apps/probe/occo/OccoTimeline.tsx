import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captionAccessible, tvControlLabel } from '../ott/src/tv-accessibility';
import { eventDetails, eventTitle, recordingSummary } from './timeline';
import type { OccoRecording } from './timeline';

const pageSize = 4;

function Action({
  label,
  selected,
  description,
  onPress,
  disabled = false,
}: {
  label: string;
  selected?: boolean;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tvControlLabel(label, description)}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      focusable={!disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[
        styles.action,
        selected && styles.selected,
        focused && styles.focused,
        disabled && styles.disabled,
      ]}
    >
      <Text
        accessible={captionAccessible}
        style={styles.label}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Details({ fields }: { fields: [string, string][] }) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [height, setHeight] = useState(0);
  const [content, setContent] = useState(0);

  const page = (direction: number) => {
    const y = Math.min(
      content - height,
      Math.max(0, offset.current + direction * Math.max(1, height - 20)),
    );

    offset.current = y;
    scroll.current?.scrollTo({ y, animated: false });
  };

  return (
    <View style={styles.details}>
      {content > height && height > 0 && (
        <View style={styles.paging}>
          <Action label="Scroll details up" onPress={() => page(-1)} />
          <Action label="Scroll details down" onPress={() => page(1)} />
        </View>
      )}
      <ScrollView
        ref={scroll}
        style={styles.details}
        onLayout={event => setHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, size) => setContent(size)}
        onScroll={event => {
          offset.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
      >
        {fields.map(([label, value]) => (
          <Text accessible={captionAccessible} key={label} style={styles.line}>
            <Text style={styles.field}>{label} </Text>
            {value}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

export function OccoTimeline({ recording }: { recording: OccoRecording }) {
  const { events } = recording;

  const lastMark = events.reduce(
    (found, event, i) =>
      event.kind === 'marker' && event.detail === 'incident' ? i : found,
    -1,
  );

  const [cursor, setCursor] = useState(
    lastMark >= 0 ? lastMark : Math.max(0, events.length - 1),
  );

  const index = Math.min(cursor, events.length - 1);
  const first = Math.max(0, Math.floor(index / pageSize) * pageSize);
  const page = events.slice(first, first + pageSize);

  return (
    <View style={styles.timeline}>
      <Text
        accessible={events.length ? captionAccessible : undefined}
        style={styles.status}
      >
        {recordingSummary(recording)}
      </Text>
      {events.length > 0 && (
        <View style={styles.body}>
          <View style={styles.events}>
            <View style={styles.paging}>
              <Action
                label="Earlier"
                disabled={first === 0}
                onPress={() => setCursor(first - pageSize)}
              />
              <Action
                label="Later"
                disabled={first + pageSize >= events.length}
                onPress={() => setCursor(first + pageSize)}
              />
              {lastMark >= 0 && (
                <Action
                  label="Latest mark"
                  onPress={() => setCursor(lastMark)}
                />
              )}
            </View>
            {page.map((event, offset) => (
              <Action
                key={event.seq}
                label={eventTitle(event)}
                description={
                  captionAccessible === false && first + offset === index
                    ? [
                        recordingSummary(recording),
                        ...eventDetails(recording, index).map(
                          ([field, value]) => `${field}: ${value}`,
                        ),
                      ].join('. ')
                    : undefined
                }
                selected={first + offset === index}
                onPress={() => setCursor(first + offset)}
              />
            ))}
          </View>
          <Details
            key={events[index].seq}
            fields={eventDetails(recording, index)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { flex: 1, backgroundColor: '#0c1722', padding: 12 },
  status: { color: '#e5f2ff', marginBottom: 8, fontSize: 16 },
  body: { flex: 1, flexDirection: 'row', gap: 16 },
  events: { flex: 1 },
  details: { flex: 1 },
  paging: { flexDirection: 'row', gap: 4, marginBottom: 5 },
  action: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
    borderColor: '#495866',
    borderWidth: 2,
    borderRadius: 4,
  },
  selected: { backgroundColor: '#204963' },
  focused: { borderColor: '#f9cf58' },
  disabled: { opacity: 0.45 },
  label: { color: 'white', fontSize: 14 },
  line: { fontSize: 14, color: '#fff', marginBottom: 2 },
  field: { color: '#9fc7db', fontWeight: 'bold' },
});
