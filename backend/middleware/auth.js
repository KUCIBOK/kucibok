const jwt = require('jsonwebtoken')
const User = require('../models/User')

/**
 * Extrait le token JWT depuis le header Authorization Bearer.
 * Retourne le token (string) ou null si absent/malformé.
 */
function extractToken(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        if (token && token !== 'null' && token !== 'undefined' && typeof token === 'string' && token.trim()) {
            return token;
        }
    }
    return null;
}

/**
 * Middleware factory — authentifie le JWT et vérifie le rôle.
 * @param {...string} roles - Rôles autorisés. Vide = tout utilisateur authentifié.
 */
function requireRole(...roles) {
    return async (req, res, next) => {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ message: 'Non autorisé — token manquant ou invalide' });
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded._id).select('-password');
            if (!user) {
                return res.status(401).json({ message: 'Non autorisé — utilisateur introuvable' });
            }
            if (!user.isActive) {
                return res.status(403).json({ message: 'Compte suspendu' });
            }
            if (roles.length > 0 && !roles.includes(user.role)) {
                return res.status(403).json({ message: 'Accès refusé — rôle insuffisant' });
            }
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Non autorisé — token invalide ou expiré' });
        }
    };
}

exports.auth         = requireRole();
exports.admin        = requireRole('admin');
exports.artist       = requireRole('artist');
exports.collector    = requireRole('collector');
exports.professional = requireRole('professional');
