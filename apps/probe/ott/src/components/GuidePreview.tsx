import React from 'react';
import { Text, View } from 'react-native';
import type { Programme } from '../guide-types';
import { guideTime } from '../guide-data';
import { useDesign } from '../theme';

export function GuidePreview({
  channel,
  programme,
}: {
  channel?: string;
  programme?: Programme;
}) {
  const { s } = useDesign();

  return (
    <View style={s.guidePreview}>
      <Text style={s.eyebrow}>{channel || 'EPGTALK'}</Text>
      <Text numberOfLines={2} style={s.heading}>
        {programme?.title || 'What’s on now and next'}
      </Text>
      <Text style={s.muted}>
        {programme
          ? `${guideTime(programme.start)}–${guideTime(programme.stop)}`
          : 'Browse channels and programme times'}
      </Text>
    </View>
  );
}
