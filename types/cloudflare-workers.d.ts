declare module "cloudflare:workers" {
  export const env: {
    DB?: import("drizzle-orm/d1").AnyD1Database;
  };
}
