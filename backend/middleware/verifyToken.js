// backend/middleware/verifyToken.js
import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Kein Token vorhanden' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    if (!req.userId) return res.status(401).json({ error: 'Ungueltiger Token' });
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Ungueltiger Token' });
  }
};
