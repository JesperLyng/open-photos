import { config } from "./config.js";

export function setErrorHandlers(app) {
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const payload = {
      error: error.name || "Error",
      message: error.message || "Request failed",
    };

    request.log.error({ err: error }, "request failed");
    reply.code(statusCode).send(payload);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: "NotFound", message: "Route not found" });
  });

  if (config.env === "development") {
    app.log.info("error handlers registered");
  }
}
