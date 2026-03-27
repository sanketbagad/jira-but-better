export function errorHandler(err, _req, res, _next) {
  console.error('Error:', err.message);
  console.error('Error code:', err.code);
  console.error('Error detail:', err.detail);

  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate entry',
      detail: err.detail,
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referenced resource not found',
      detail: err.detail,
    });
  }

  // PostgreSQL check constraint violation
  if (err.code === '23514') {
    return res.status(400).json({
      error: 'Invalid value',
      detail: err.detail,
      constraint: err.constraint,
    });
  }

  // JWT errors handled in auth middleware, but catch any strays
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}
