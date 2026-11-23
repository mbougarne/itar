import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AppleCommands,
  AppleSurface,
  AppleTarget,
} from '@bougarnem/itar/apple';

import { BusyJsButton } from './diagnostics/BusyJsButton';
import { CarrierControls } from './diagnostics/CarrierControls';

import { carrierCards, carrierDestination } from './diagnostics/carrier-data';

// Exercise the Apple native carrier directly, including commands and mount replacement.
export default function AppleAdapterScreen() {
  const surface = useRef<React.ElementRef<typeof AppleSurface>>(null);
  const [mounted, setMounted] = useState(true);
  const [active, setActive] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [focus, setFocus] = useState('Unknown');
  const [request, setRequest] = useState({ lifetime: '0', request: '0' });
  const [outcome, setOutcome] = useState('None');
  const [activation, setActivation] = useState('None');

  return (
    <View style={styles.screen}>
      <CarrierControls
        active={active}
        mountLabel={mounted ? 'Unmount B' : 'Mount B'}
        onFocus={() =>
          surface.current &&
          AppleCommands.focus(surface.current, carrierDestination)
        }
        onCancel={() =>
          surface.current &&
          AppleCommands.cancel(
            surface.current,
            request.lifetime,
            request.request,
          )
        }
        onShowDialog={() =>
          surface.current && AppleCommands.showDialog(surface.current)
        }
        onToggleMount={() => setMounted(value => !value)}
        onToggleActive={() => setActive(value => !value)}
        onReset={() => setGeneration(value => value + 1)}
      />
      <BusyJsButton />
      <AppleSurface
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
              <AppleTarget
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
      </AppleSurface>
      <Text>Observed input focus: {focus}</Text>
      <Text>
        Request {request.request}: {outcome}; last activation: {activation}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  first: { left: 0, top: 0 },
  second: { left: 310, top: 0 },
  third: { left: 0, top: 110 },
  fourth: { left: 310, top: 110 },
  surface: { width: 620, height: 210 },
  card: { position: 'absolute', width: 290, height: 90 },
});

const positions = [styles.first, styles.second, styles.third, styles.fourth];
