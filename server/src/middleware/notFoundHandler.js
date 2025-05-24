/**
 * 404 Not Found handler
 */
export default (req, res, next) => {
    res.status(404).json({ 
      message: `Route not found: ${req.method} ${req.originalUrl}` 
    });
  };