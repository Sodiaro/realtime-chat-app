export const errorHandler = (err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;

  // only surface messages I've explicitly marked safe; rest stay generic
  const message =
    err.expose && err.message ? err.message : "Internal Server Error";

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(status).json({ message });
};

export const notFound = (req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
};
