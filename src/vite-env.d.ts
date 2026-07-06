/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DEV_SERVER_PORT?: string;
	readonly VITE_TRANSCRIPTION_API_BASE?: string;
	readonly VITE_TRANSCRIPTION_PROXY_TARGET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
