import type { ErrorRequestHandler, RequestHandler } from "express";

interface HttpError {
  status?: number;
  statusCode?: number;
  expose?: boolean;
  message?: string;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const e = err as HttpError;
  const status = e.status || e.statusCode || 500;

  // only surface messages I've explicitly marked safe; rest stay generic
  const message = e.expose && e.message ? e.message : "Internal Server Error";

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(status).json({ message });
};

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
};
