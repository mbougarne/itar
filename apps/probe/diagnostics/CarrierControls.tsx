import React from 'react';
import { Button, StyleSheet, View } from 'react-native';

type Props = {
  active: boolean;
  mountLabel: string;
  onFocus: () => void;
  onCancel: () => void;
  onShowDialog: () => void;
  onToggleMount: () => void;
  onToggleActive: () => void;
  onReset: () => void;
};

export function CarrierControls(props: Props) {
  return (
    <View style={styles.controls}>
      <Button title="Focus rail B" onPress={props.onFocus} />
      <Button title="Cancel request" onPress={props.onCancel} />
      <Button title="Owned dialog" onPress={props.onShowDialog} />
      <Button title={props.mountLabel} onPress={props.onToggleMount} />
      <Button
        title={props.active ? 'Cover route' : 'Return route'}
        onPress={props.onToggleActive}
      />
      <Button title="Fresh surface" onPress={props.onReset} />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
