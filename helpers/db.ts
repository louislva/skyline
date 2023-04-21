import pgLib from "pg-promise";

function createSingleton<T>(name: string, create: () => T): T {
  const s = Symbol.for(name);
  let scope = (global as any)[s];
  if (!scope) {
    scope = { ...create() };
    (global as any)[s] = scope;
  }
  return scope;
}

const pgp = pgLib();

interface IDatabaseScope {
  db: pgLib.IDatabase<any>;
  pgp: pgLib.IMain;
}

export function getDB(): IDatabaseScope {
  return createSingleton<IDatabaseScope>("database", () => {
    return {
      db: pgp(process.env.DATABASE!),
      pgp,
    };
  });
}
