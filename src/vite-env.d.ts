/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string
          callback: (response: { credential: string }) => void
        }) => void
        renderButton: (
          parent: HTMLElement,
          options: {
            theme?: string
            size?: string
            shape?: string
            width?: number
            text?: string
          },
        ) => void
        prompt: () => void
      }
    }
  }
}
