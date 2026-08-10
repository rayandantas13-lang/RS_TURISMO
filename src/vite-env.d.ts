/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do aplicativo web do Google Apps Script (variável do repositório GitHub). */
  readonly VITE_APPS_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
