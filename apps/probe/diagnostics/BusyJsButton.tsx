import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'react-native';
import { blockJavaScript } from './blockJavaScript';

export function BusyJsButton({ logPrefix }: { logPrefix?: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scheduled, setScheduled] = useState(false);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function schedule() {
    setScheduled(true);

    timer.current = setTimeout(() => {
      timer.current = null;

      if (logPrefix) {
        console.info(logPrefix + ' JS busy start');
      }

      blockJavaScript(2000);

      if (logPrefix) {
        console.info(logPrefix + ' JS busy end');
      }

      setScheduled(false);
    }, 1000);
  }

  return (
    <Button
      title={scheduled ? 'JS block scheduled' : 'Block JS after 1 second'}
      disabled={scheduled}
      onPress={schedule}
    />
  );
}
