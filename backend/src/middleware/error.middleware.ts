import type { ErrorRequestHandler, RequestHandler } from "express";

interface HttpError {
  status?: number;
  statusCode?: number;
  expose?: boolean;
  message?: string;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const e = err as HttpError & { code?: number };

  // a unique-index race (two identical creates at once) surfaces as a clean conflict
  const isDuplicate = e.code === 11000;
  const status = isDuplicate ? 409 : e.status || e.statusCode || 500;

  // only surface messages I've explicitly marked safe; rest stay generic
  const message = isDuplicate
    ? "That name is already taken"
    : e.expose && e.message
      ? e.message
      : "Internal Server Error";

  if (status >= 500) {
    req.log.error({ err }, `${req.method} ${req.originalUrl} failed`);
  }

  res.status(status).json({ message });
};

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
};
