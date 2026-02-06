import { buildServer } from "./app.js";
import { connectDb } from "./lib/db.js";
import { config } from "./lib/config.js";

const app = buildServer();

async function start() {
  await connectDb();
  await app.listen({ port: config.port, host: config.host });
  app.log.info({ port: config.port, host: config.host }, "server started");
  app.log.info(
    { issuer: config.oidcIssuer, audience: config.oidcAudience },
    "oidc configured",
  );
}

start().catch((err) => {
  app.log.error(err, "server failed to start");
  process.exit(1);
});
