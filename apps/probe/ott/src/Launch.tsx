import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { captionAccessible, tvControlLabel } from './tv-accessibility';
import TVApp from './TVApp';
import { useDesign } from './theme';

export default function Launch({
  onOpenProbes,
}: {
  onOpenProbes?: () => void;
}) {
  const { s } = useDesign();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1200);

    return () => clearTimeout(timer);
  }, []);

  return splash ? (
    <View style={s.splash}>
      <Text
        accessibilityLabel={
          captionAccessible === false
            ? tvControlLabel('Itar Cinema', 'Stories worth exploring.')
            : undefined
        }
        style={s.splashBrand}
      >
        <Text style={s.brandStrong}>ITAR</Text> CINEMA
      </Text>
      <Text accessible={captionAccessible} style={s.muted}>
        Stories worth exploring.
      </Text>
    </View>
  ) : (
    <TVApp onOpenProbes={onOpenProbes} />
  );
}
