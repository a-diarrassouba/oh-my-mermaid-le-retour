export interface Platform {
  /** Display name (e.g. "Claude Code") */
  name: string;
  /** CLI-facing id (e.g. "claude") */
  id: string;
  /** Is the tool binary installed on this machine? */
  detect(): boolean;
  /** Are prisme skills already registered? */
  isSetup(): boolean;
  /** Register prisme skills/plugin */
  setup(): Promise<void>;
  /** Unregister prisme skills/plugin */
  teardown(): void;
}
