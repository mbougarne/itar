import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
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
      <Text style={s.splashBrand}>
        <Text style={s.brandStrong}>ITAR</Text> CINEMA
      </Text>
      <Text style={s.muted}>Stories worth exploring.</Text>
    </View>
  ) : (
    <TVApp onOpenProbes={onOpenProbes} />
  );
}
