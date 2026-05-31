import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useState } from "react";

interface CapsLockEventLike {
  getModifierState?: (key: string) => boolean;
}

export function isCapsLockOn(event: CapsLockEventLike): boolean {
  return event.getModifierState?.("CapsLock") === true;
}

export function useCapsLockWarning() {
  const [capsLockOn, setCapsLockOn] = useState(false);

  const updateFromKeyboardEvent = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      setCapsLockOn(isCapsLockOn(event.nativeEvent));
    },
    [],
  );

  const hide = useCallback(() => setCapsLockOn(false), []);

  return {
    capsLockOn,
    inputProps: {
      onKeyDown: updateFromKeyboardEvent,
      onKeyUp: updateFromKeyboardEvent,
      onBlur: hide,
    },
  };
}
