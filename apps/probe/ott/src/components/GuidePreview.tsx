import React from 'react';
import { Text, View } from 'react-native';
import { guideTime, useGuide } from '../guide';
import { useDesign } from '../theme';

export function GuidePreview() {
  const { s } = useDesign();
  const { guide } = useGuide(true);
  const channels = guide?.channels.slice(0, 3) ?? [];

  return (
    <View style={s.row}>
      {(channels.length ? channels : [null]).map(channel => {
        const programme = channel?.programmes.find(
          p => p.stop > Date.now() / 1000,
        );

        return (
          <View key={channel?.id ?? 'guide'} style={[s.fill, s.guidePreview]}>
            <Text style={s.eyebrow}>{channel?.name || 'EPGTALK'}</Text>
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
      })}
    </View>
  );
}
