import fs from "node:fs";
// Safety net: never leave the temporary server settings behind (they would replace .env.local for the next dev run).
export default async function globalTeardown() { fs.rmSync(".dev.vars", { force: true }); }
