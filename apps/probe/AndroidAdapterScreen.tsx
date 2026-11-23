import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AndroidCommands,
  AndroidSurface,
  AndroidTarget,
} from '@bougarnem/itar/android';

import { BusyJsButton } from './diagnostics/BusyJsButton';
import { CarrierControls } from './diagnostics/CarrierControls';

import { carrierCards, carrierDestination } from './diagnostics/carrier-data';

// Exercise the Android native carrier directly, including commands and mount replacement.
export default function AndroidAdapterScreen() {
  const surface = useRef<React.ElementRef<typeof AndroidSurface>>(null);
  const [mounted, setMounted] = useState(true);
  const [active, setActive] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [focus, setFocus] = useState('Unknown');
  const [request, setRequest] = useState({ lifetime: '0', request: '0' });
  const [outcome, setOutcome] = useState('None');
  const [activation, setActivation] = useState('None');

  return (
    <View style={styles.screen}>
      <Text>Android adapter preview — device/reader acceptance pending</Text>
      <CarrierControls
        active={active}
        mountLabel="Unmount B"
        onFocus={() =>
          surface.current &&
          AndroidCommands.focus(surface.current, carrierDestination)
        }
        onCancel={() =>
          surface.current &&
          AndroidCommands.cancel(
            surface.current,
            request.lifetime,
            request.request,
          )
        }
        onShowDialog={() =>
          surface.current && AndroidCommands.showDialog(surface.current)
        }
        onToggleMount={() => setMounted(value => !value)}
        onToggleActive={() => setActive(value => !value)}
        onReset={() => setGeneration(value => value + 1)}
      />
      <BusyJsButton logPrefix="ItarAdapter" />
      <AndroidSurface
        key={generation}
        ref={surface}
        active={active}
        style={styles.surface}
        onFocusRecord={event => {
          const record = event.nativeEvent;

          if (record.channel === 'input') {
            setFocus(
              `${record.kind}: ${record.occurrenceKey} [${record.lifetime}/${record.mount}]`,
            );
          }
        }}
        onRequestRecord={event => {
          setRequest(event.nativeEvent);
          setOutcome(event.nativeEvent.status);
        }}
      >
        {carrierCards.map(
          (card, index) =>
            (mounted || card.key !== carrierDestination) && (
              <AndroidTarget
                key={card.key}
                occurrenceKey={card.key}
                label={card.label}
                order={index}
                baseColor="#222222"
                focusColor="#ff8800"
                style={[styles.card, positions[index]]}
                onActivate={event =>
                  setActivation(
                    `${event.nativeEvent.occurrenceKey}: ${event.nativeEvent.source} #${event.nativeEvent.sequence}`,
                  )
                }
              />
            ),
        )}
      </AndroidSurface>
      <Text>Observed input focus: {focus}</Text>
      <Text>
        Request {request.request}: {outcome}; last JS activation: {activation}
      </Text>
      <Text>
        Reader-owned input stays native. JS callbacks can arrive after
        highlighting.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 10 },
  first: { left: 0, top: 0 },
  second: { left: 290, top: 0 },
  third: { left: 0, top: 100 },
  fourth: { left: 290, top: 100 },
  surface: { width: 600, height: 190 },
  card: { position: 'absolute', width: 270, height: 80 },
});

const positions = [styles.first, styles.second, styles.third, styles.fourth];
