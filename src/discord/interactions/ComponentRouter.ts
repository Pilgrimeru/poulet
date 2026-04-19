import { MessageComponentInteraction, MessageFlags, ModalSubmitInteraction } from "discord.js";

export type AnyDispatchableInteraction = MessageComponentInteraction | ModalSubmitInteraction;
// Handlers use MessageComponentInteraction as the base type; the dispatch method accepts modals too.
// Application handlers that need modals use `instanceof` checks at runtime.
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
    this.prefixes.sort((a, b) => b.prefix.length - a.prefix.length);
  }

  unregister(customId: string): void {
    this.exact.delete(customId);
  }

  unregisterPrefix(prefix: string): void {
    this.prefixes = this.prefixes.filter((p) => p.prefix !== prefix);
  }

  async dispatch(interaction: AnyDispatchableInteraction): Promise<boolean> {
    const now = Date.now();
    const { customId } = interaction;
    // Cast is safe: handlers that need to handle modals use instanceof at runtime.
    const i = interaction as MessageComponentInteraction;

    try {
      const exact = this.exact.get(customId);
      if (exact) {
        if (exact.expireAt && now > exact.expireAt) {
          this.exact.delete(customId);
          return false;
        }
        await exact.handler(i);
        return true;
      }

      for (const { prefix, entry } of this.prefixes) {
        if (customId.startsWith(prefix)) {
          if (entry.expireAt && now > entry.expireAt) {
            this.unregisterPrefix(prefix);
            return false;
          }
          await entry.handler(i);
          return true;
        }
      }
    } catch (error) {
      console.error("[componentRouter] interaction handler failed", { customId, error });
      try {
        if (interaction.isRepliable()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: "Une erreur est survenue pendant le traitement de l'interaction.", flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: "Une erreur est survenue pendant le traitement de l'interaction.", flags: MessageFlags.Ephemeral });
          }
        }
      } catch (replyError) {
        console.error("[componentRouter] failed to send fallback interaction error", replyError);
      }
    }
    return false;
  }
}

export const componentRouter = new ComponentRouter();
