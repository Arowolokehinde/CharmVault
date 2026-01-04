/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHARMS_PROVER_API: string
  readonly VITE_APP_VK: string
  readonly VITE_BITCOIN_NETWORK: string
  readonly VITE_BITCOIN_EXPLORER: string
  readonly VITE_BITCOIN_RPC_URL: string
  readonly VITE_DEFAULT_TRIGGER_DELAY_BLOCKS: string
  readonly VITE_MIN_VAULT_AMOUNT: string
  readonly VITE_APP_NAME: string
  readonly VITE_WASM_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
