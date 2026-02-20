require('dotenv').config()
const logger = require('../utils/logger');

exports.errorHandler = (error, req, res, next) => {
  // P2-ARCH-005 — Log structuré via Winston (remplace console.error)
  logger.error(error.message, {
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: error.statusCode,
  });

  // Erreur par défaut
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code || 'INTERNAL_ERROR';

  // Gestion des erreurs spécifiques de MongoDB
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
    
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  }

  if (error.name === 'MongoServerError' && (error).code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value';
    code = 'DUPLICATE_FIELD';
  }

  // Gestion des erreurs JWT
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Réponse d'erreur
  const errorResponse = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
  };

  // En développement, inclure la stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};


/**
 * Middleware pour gérer les routes non trouvées
 */
exports.notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
  });
};

/**
 * Classe pour créer des erreurs personnalisées
 */
class CustomError extends Error {
    statusCode;
    code;
    isOperational;

    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Fonctions utilitaires pour créer des erreurs courantes
 * L'objet général contient des méthodes qui créent des erreurs
 * courantes dans l'app avec notre CustomError, ça lance des Error
 * (je vois ça en exception comme en PHP désolé)
 * On peut utiliser ces fonctions dans les controlleurs,
 * le middleware qui attrape toutes les erreurs s'en occupera.
 */
exports.createError = {
    badRequest: (message, code = 'BAD_REQUEST') =>
        new CustomError(message, 400, code),

    unauthorized: (message, code = 'UNAUTHORIZED') =>
        new CustomError(message, 401, code),

    forbidden: (message, code = 'FORBIDDEN') =>
        new CustomError(message, 403, code),

    notFound: (message, code = 'NOT_FOUND') =>
        new CustomError(message, 404, code),

    conflict: (message, code = 'CONFLICT') =>
        new CustomError(message, 409, code),

    internal: (message, code = 'INTERNAL_ERROR') =>
        new CustomError(message, 500, code),
};

/**
 * P2-ARCH-005 — Wrapper asyncHandler
 *
 * Express 5 propage déjà les rejets de promesses vers next() nativement.
 * Ce wrapper reste utile pour :
 *   - Compatibilité explicite si on rétrograde vers Express 4
 *   - Clarté dans les controllers qui ne veulent pas de try/catch
 *   - Uniformité du style de code
 *
 * Usage : router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
exports.asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};