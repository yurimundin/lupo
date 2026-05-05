// Hook que lê a versão do app definida em src-tauri/tauri.conf.json,
// exposta pelo Tauri via @tauri-apps/api/app.getVersion().
//
// Estado inicial: string vazia (renderiza placeholder "..." enquanto
// resolve). Após o load assíncrono, o estado vira a versão real
// (ex: "0.1.0-alpha"). Em erro de IPC (cenário improvável — chamada
// nativa síncrona internamente), loga e mantém vazio.

import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

export function useAppVersion(): string {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    getVersion()
      .then((v) => {
        if (mounted) setVersion(v);
      })
      .catch((err) => {
        console.error("Falha ao obter versão do app:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return version;
}
