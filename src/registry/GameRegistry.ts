import type { GameDefinition, GameMetadata } from "@boredgame/core";
import { ENGINE_PROTOCOL_VERSION } from "./engineVersion";
import { loadGameFromUrl } from "./remoteLoader";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGame = GameDefinition<any, any>;

export type CompatibilityResult = {
  compatible: boolean;
  engine: { compatible: boolean; expected: string; actual: string };
  issues: string[];
};

type LazyEntry = {
  type: "lazy";
  loader: () => Promise<AnyGame>;
};

type RemoteEntry = {
  type: "remote";
  url: string;
};

type RegistryEntry = {
  definition?: AnyGame;
  source: LazyEntry | RemoteEntry | { type: "static" };
};

const parseSemver = (v: string): number[] =>
  v.split(".").map((n) => {
    const parsed = parseInt(n, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });

export class GameRegistry {
  private entries = new Map<string, RegistryEntry>();

  register(def: AnyGame): void {
    this.entries.set(def.id, { definition: def, source: { type: "static" } });
  }

  registerAll(defs: AnyGame[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  registerLazy(id: string, loader: () => Promise<AnyGame>): void {
    this.entries.set(id, { source: { type: "lazy", loader } });
  }

  registerRemote(id: string, url: string): void {
    this.entries.set(id, { source: { type: "remote", url } });
  }

  get(id: string): AnyGame | undefined {
    return this.entries.get(id)?.definition;
  }

  list(): AnyGame[] {
    const result: AnyGame[] = [];
    for (const entry of this.entries.values()) {
      if (entry.definition) {
        result.push(entry.definition);
      }
    }
    return result;
  }

  listMeta(): Array<{ id: string; loaded: boolean } & GameMetadata> {
    const result: Array<{ id: string; loaded: boolean } & GameMetadata> = [];
    for (const [id, entry] of this.entries.entries()) {
      if (entry.definition) {
        result.push({ id, loaded: true, ...entry.definition.metadata });
      }
    }
    return result;
  }

  async load(id: string): Promise<AnyGame> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Game "${id}" is not registered`);
    }
    if (entry.definition) {
      return entry.definition;
    }
    if (entry.source.type === "lazy") {
      const def = await entry.source.loader();
      entry.definition = def;
      return def;
    }
    if (entry.source.type === "remote") {
      const def = await loadGameFromUrl(entry.source.url);
      entry.definition = def;
      return def;
    }
    throw new Error(`Game "${id}" has no loader`);
  }

  checkCompatibility(def: AnyGame): CompatibilityResult {
    const engineExpected = def.version.engine;
    const engineParts = parseSemver(engineExpected);
    const actualParts = parseSemver(ENGINE_PROTOCOL_VERSION);

    const engineCompatible =
      engineParts.length > 0 &&
      actualParts.length > 0 &&
      engineParts[0] === actualParts[0];

    const issues: string[] = [];
    if (!engineCompatible) {
      issues.push(
        `Engine protocol version mismatch: game expects "${engineExpected}", engine is "${ENGINE_PROTOCOL_VERSION}"`
      );
    }

    return {
      compatible: engineCompatible,
      engine: {
        compatible: engineCompatible,
        expected: engineExpected,
        actual: ENGINE_PROTOCOL_VERSION
      },
      issues
    };
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }
}
