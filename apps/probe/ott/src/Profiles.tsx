import React from 'react';
import { Image, Text, View } from 'react-native';
import { Focusable, FocusScope, occurrenceKey } from 'itar/react';
import { Picture } from './components/Picture';
import { art, icons } from './artwork';
import { useDesign } from './theme';

export function Profiles({
  id,
  profile,
  onSelect,
  highContrast,
}: {
  id: string;
  profile: string;
  onSelect: (name: string) => void;
  highContrast: boolean;
}) {
  const { s, u } = useDesign();
  const names = ['Explorer', 'Stargazer'];
  const focusStyle = { accentColor: highContrast ? '#FFFFFF' : '#26D9F2' };

  return (
    <View style={s.profilePage}>
      <Text style={s.chooserTitle}>Who’s exploring?</Text>
      <Text style={[s.subtitle, s.centered]}>
        Choose a local profile. Session only.
      </Text>
      <FocusScope id="choices" layout="row" boundary="stop" style={s.profiles}>
        {[...names, 'Add a New Profile'].map((name, index) => (
          <View key={name}>
            <View style={s.chooserCard}>
              {index < 2 ? (
                <Picture
                  source={art[index === 0 ? 0 : 3]}
                  style={s.profilePicture}
                  fallback="Profile artwork unavailable"
                />
              ) : (
                <View style={s.addProfileImage}>
                  <Image source={icons.Profile} style={s.addProfileIcon} />
                </View>
              )}
              <Focusable
                order={index}
                occurrenceKey={occurrenceKey(id, name)}
                accessibilityLabel={
                  index === 2
                    ? 'Add a New Profile, unavailable in this showcase'
                    : name === profile
                    ? `${name}, current profile`
                    : name
                }
                displayLabel={name}
                labelPlacement="bottom-center"
                labelSize={24 * u}
                outlineInsetBottom={48 * u}
                baseAccentColor="#F4EEE4"
                focusStyle={focusStyle}
                style={s.chooserAction}
                onPress={() => {
                  if (index < 2) {
                    onSelect(name);
                  }
                }}
              />
            </View>
            {name === profile && (
              <View style={s.currentProfile}>
                <Image source={icons.check} style={s.check} />
                <Text style={s.muted}>Current profile</Text>
              </View>
            )}
          </View>
        ))}
      </FocusScope>
      <Text style={[s.footer, s.centered]}>
        New profiles aren’t available in this demo.
      </Text>
    </View>
  );
}
