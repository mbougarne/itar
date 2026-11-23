import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useScreenReaderEnabled } from '@bougarnem/itar/react';
import type { Film } from '../catalog-types';
import { filmArtwork } from '../artwork';
import { useDesign } from '../theme';
import { Picture } from './Picture';
import { PreviewVideo } from './PreviewVideo';

const HomePreviewActivity = createContext(false);

export function HomePreviewProvider({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const reader = useScreenReaderEnabled();

  return (
    <HomePreviewActivity.Provider
      value={active && (reader === false || Platform.OS === 'web')}
    >
      {children}
    </HomePreviewActivity.Provider>
  );
}

function PreviewSession({ poster }: { poster: React.ReactElement }) {
  const { u } = useDesign();

  const [stage, setStage] = useState<
    'waiting' | 'loading' | 'playing' | 'finished'
  >('waiting');

  const finish = useCallback(() => setStage('finished'), []);

  const ready = useCallback(
    () => setStage(previous => (previous === 'loading' ? 'playing' : previous)),
    [],
  );

  useEffect(() => {
    if (AppState.currentState !== 'active') return;

    const delay = setTimeout(() => setStage('loading'), 700);

    const state = AppState.addEventListener('change', value => {
      if (value !== 'active') {
        clearTimeout(delay);
        finish();
      }
    });

    return () => {
      clearTimeout(delay);
      state.remove();
    };
  }, [finish]);

  useEffect(() => {
    if (stage !== 'loading' && stage !== 'playing') return;

    // A failed or stalled stream must release its decoder and reveal the still.
    const timer = setTimeout(finish, stage === 'loading' ? 8_000 : 10_000);

    return () => clearTimeout(timer);
  }, [stage, finish]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {(stage === 'loading' || stage === 'playing') && (
        <PreviewVideo onFinish={finish} onReady={ready} />
      )}
      {/* Keep the native surface laid out at full opacity from its first frame. */}
      {stage === 'playing' ? (
        <Text
          numberOfLines={1}
          style={[
            styles.credit,
            { bottom: 9 * u, right: 10 * u, fontSize: 16 * u },
          ]}
        >
          Big Buck Bunny · Blender Foundation · CC BY 3.0
        </Text>
      ) : (
        poster
      )}
    </View>
  );
}

export function HomePreviewCard({
  film,
  occurrence,
  width,
  height,
}: {
  film: Film;
  occurrence: string;
  width: number;
  height: number;
}) {
  const active = useContext(HomePreviewActivity);
  const focused = useIsFocused(occurrence);
  const { u } = useDesign();
  // The collection has a fixed stride. Expand the image inside its reserved
  // slot so the target retains its identity and its neighbors keep their order.
  const stableArtwork = Platform.OS === 'ios' && Platform.isTV && !active;
  const cardWidth = focused || stableArtwork ? width : width * 0.87;

  const poster = (
    <Picture
      source={filmArtwork(film)}
      style={{ width: cardWidth, height }}
      fallback="Artwork unavailable"
    />
  );

  return (
    <View
      style={[styles.frame, { width: cardWidth, height, borderRadius: 8 * u }]}
    >
      {active && focused ? <PreviewSession poster={poster} /> : poster}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  credit: {
    position: 'absolute',
    color: 'white',
    backgroundColor: 'rgba(6,13,20,0.82)',
    paddingHorizontal: 4,
  },
});
