import { useEffect } from 'react';
import { useIsFocused } from 'itar/react';

export function EndObserver({
  id,
  active,
  blocked,
  onEnd,
}: {
  id: string;
  active: boolean;
  blocked: boolean;
  onEnd: () => void;
}) {
  const focused = useIsFocused(id);

  useEffect(() => {
    if (focused && active && !blocked) {
      onEnd();
    }
  }, [focused, active, blocked, onEnd]);

  return null;
}
