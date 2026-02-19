require('dotenv').config()

/**
 * Fonction pour obtenir une variable d'environnement avec valeur par défaut
 */
const getEnvVar = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

exports.config = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: parseInt(getEnvVar('PORT', '3001'), 10),
  host: getEnvVar('HOST', '0.0.0.0'),
  
  database: {
    uri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/kucibok'),
  },
  
  redis: {
    url: process.env.REDIS_URL,
  },
  
  jwt: {
    secret: getEnvVar('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production'),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', '7d'),
  },
  
  cors: {
    origin: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
  },
  
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  
  rateLimit: {
    windowMs: parseInt(getEnvVar('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    maxRequests: parseInt(getEnvVar('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },
  
  upload: {
    maxFileSize: parseInt(getEnvVar('MAX_FILE_SIZE', '10485760'), 10),
    path: getEnvVar('UPLOAD_PATH', 'public/uploads'),
  },
  paydunya: {
    masterKey: getEnvVar('PAYDUNYA_MASTER_KEY', 'test-master-key'),
    privateKey: getEnvVar('PAYDUNYA_PRIVATE_KEY', 'test-private-key'),
    token: getEnvVar('PAYDUNYA_TOKEN', 'test-token'),
    mode: getEnvVar('PAYDUNYA_MODE', 'sandbox'),
    store: {
      name: getEnvVar('PAYDUNYA_STORE_NAME', 'Kucibok'),
      address: getEnvVar('PAYDUNYA_STORE_ADDRESS', 'test-store-address'),
      phone: getEnvVar('PAYDUNYA_STORE_PHONE', '+221123456789'),
      tagline: getEnvVar('PAYDUNYA_STORE_TAGLINE', 'Plateforme d\'art numérique africain'),
    },
  },

  adminEmail: getEnvVar('ADMIN_EMAIL', 'admin@example.com'),

  wallet: {
    encryptionKey: getEnvVar('WALLET_ENCRYPTION_KEY', ''),
  },

  log: {
    level: getEnvVar('LOG_LEVEL', 'info'),
  },
}