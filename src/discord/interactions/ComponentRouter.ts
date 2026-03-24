import { MessageComponentInteraction } from "discord.js";

type ComponentHandler = (interaction: MessageComponentInteraction) => Promise<void> | void;

interface RegisteredHandler {
  handler: ComponentHandler;
  expireAt?: number; // timestamp ms, undefined = permanent
}

export class ComponentRouter {
  private readonly exact = new Map<string, RegisteredHandler>();
  private prefixes: Array<{ prefix: string; entry: RegisteredHandler }> = [];

  register(customId: string, handler: ComponentHandler, ttlMs?: number): void {
    this.exact.set(customId, {
      handler,
      expireAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  registerPrefix(prefix: string, handler: ComponentHandler, ttlMs?: number): void {
    this.prefixes.push({
      prefix,
      entry: {
        handler,
        expireAt: ttlMs ? Date.now() + ttlMs : undefined,
      },
    });
  }

  unregister(customId: string): void {
    this.exact.delete(customId);
  }

  unregisterPrefix(prefix: string): void {
    this.prefixes = this.prefixes.filter((p) => p.prefix !== prefix);
  }

  unregisterAllWithPrefix(prefix: string): void {
    // unregisters all exact keys that start with prefix
    for (const key of this.exact.keys()) {
      if (key.startsWith(prefix)) this.exact.delete(key);
    }
    this.unregisterPrefix(prefix);
  }

  async dispatch(interaction: MessageComponentInteraction): Promise<void> {
    const now = Date.now();
    const { customId } = interaction;

    const exact = this.exact.get(customId);
    if (exact) {
      if (exact.expireAt && now > exact.expireAt) {
        this.exact.delete(customId);
        return;
      }
      await exact.handler(interaction);
      return;
    }

    for (const { prefix, entry } of this.prefixes) {
      if (customId.startsWith(prefix)) {
        if (entry.expireAt && now > entry.expireAt) {
          this.unregisterPrefix(prefix);
          return;
        }
        await entry.handler(interaction);
        return;
      }
    }
  }
}

export const componentRouter = new ComponentRouter();
