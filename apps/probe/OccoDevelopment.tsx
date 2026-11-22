import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Modal,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DevelopmentSettings } from './ott/src/development-settings';
import type { DevelopmentAction } from './ott/src/development-settings';
import { OccoTimeline } from './occo/OccoTimeline';
import { parseRecording } from './occo/timeline';
import type { OccoRecording } from './occo/timeline';

type State = 'idle' | 'recording' | 'frozen';

type Recorder = {
  state(): Promise<State>;
  start(): Promise<void>;
  mark(): Promise<State>;
  freeze(): Promise<void>;
  snapshot(): Promise<string>;
  exportRecording(): Promise<string>;
};

// The TV development app registers this module. Capture belongs to the native
// process, so switching screens or reloading React cannot erase an incident.
const recorder: Recorder | undefined = NativeModules.Occo;

export function OccoDevelopment({ children }: React.PropsWithChildren) {
  const [state, setState] = useState<State>('idle');
  const [recording, setRecording] = useState<OccoRecording | null>(null);
  const [message, setMessage] = useState('');
  const busy = useRef(false);

  const refresh = useCallback(() => {
    recorder
      ?.state()
      .then(setState)
      .catch(error => setMessage(String(error)));
  }, []);

  useEffect(refresh, [refresh]);

  const run = async (work: (native: Recorder) => Promise<void>) => {
    if (!recorder || busy.current) return;

    busy.current = true;

    try {
      setMessage('');
      await work(recorder);
      setState(await recorder.state());
    } catch (error) {
      setMessage(String(error));
    } finally {
      busy.current = false;
    }
  };

  if (!recorder) return <>{children}</>;

  const actions: DevelopmentAction[] = [
    {
      key: 'occo-record',
      title: 'Occo focus debugger',
      label:
        state === 'recording' ? 'Mark Occo incident' : 'Start Occo recording',
      value:
        message ||
        (state === 'recording'
          ? 'Recording'
          : state === 'frozen'
          ? 'Start a new trace'
          : 'Idle'),
      press: () =>
        run(async native => {
          if (state === 'recording') {
            if ((await native.mark()) === 'recording')
              setMessage('Incident marked');
          } else {
            await native.start();
          }
        }),
    },
  ];

  if (state !== 'idle') {
    actions.push({
      key: 'occo-inspect',
      title: '',
      label:
        state === 'recording'
          ? 'Freeze and inspect Occo recording'
          : 'Inspect Occo recording',
      value: 'Event timeline',
      press: () =>
        run(async native => {
          await native.freeze();
          setRecording(parseRecording(await native.snapshot()));
        }),
    });
  }

  return (
    <DevelopmentSettings.Provider value={{ actions, refresh }}>
      {children}
      {recording && (
        <Modal visible onRequestClose={() => setRecording(null)}>
          <View style={styles.screen}>
            <OccoTimeline recording={recording} />
            <View style={styles.controls}>
              <Button
                title="Export recording"
                onPress={() =>
                  run(async native => {
                    const path = await native.exportRecording();

                    setMessage(
                      'Saved to ' +
                        (Platform.OS === 'ios'
                          ? path
                          : 'files/occo/latest.json'),
                    );
                  })
                }
              />
              <Button
                title="Return to Cinema"
                onPress={() => setRecording(null)}
              />
            </View>
            {!!message && (
              <Text accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            )}
          </View>
        </Modal>
      )}
    </DevelopmentSettings.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101722', padding: 16 },
  controls: { flexDirection: 'row', gap: 16 },
  message: { color: 'white' },
});
