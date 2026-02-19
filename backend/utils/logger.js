// P1-SEC-010 — Logger structuré Winston
// Remplace les console.log/error critiques par un logger centralisé,
// configurable par environnement et capable d'écrire dans des fichiers de log.
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// Dossier de logs à la racine du backend
const LOG_DIR = path.resolve(__dirname, '../logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const isProduction = process.env.NODE_ENV === 'production';

// Format lisible en développement
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level}: ${stack || message}${metaStr}`;
  })
);

// Format JSON structuré en production (compatible ELK/Datadog)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports = [
  // Console toujours activée
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
    silent: process.env.NODE_ENV === 'test',
  }),
];

// En production : écriture dans des fichiers rotatifs
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: prodFormat,
      maxsize: 10 * 1024 * 1024, // 10 Mo
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: prodFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: isProduction ? 'warn' : 'debug',
  transports,
  // Capturer les exceptions et rejections non gérées
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'rejections.log') }),
  ],
  exitOnError: false,
});

module.exports = logger;
