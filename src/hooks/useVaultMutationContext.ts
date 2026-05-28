import type { Kdbx } from "kdbxweb";

import { useVaultStore } from "@/stores/vault";

export interface VaultMutationContext {
  kdbx: Kdbx;
  lastFilePath: string;
  incrementVaultVersion: () => void;
}

export function useVaultMutationContext(): VaultMutationContext | null {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);

  if (!kdbx || !lastFilePath) return null;

  return {
    kdbx,
    lastFilePath,
    incrementVaultVersion,
  };
}
