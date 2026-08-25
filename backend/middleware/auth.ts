import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-12345';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    username: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' | string;
    isAdmin: boolean;
    companyId?: number | null;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      name: decoded.name,
      username: decoded.username,
      role: decoded.role,
      isAdmin: decoded.isAdmin,
      companyId: decoded.companyId !== undefined ? decoded.companyId : null
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export function getTenantCompanyId(req: Request): number | null {
  let user = (req as AuthenticatedRequest).user;
  if (!user && req.headers.authorization?.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      user = jwt.verify(token, JWT_SECRET) as any;
      (req as AuthenticatedRequest).user = user;
    } catch (e) {}
  }
  if (!user) return null;
  const isSuper = user.role === 'SUPER_ADMIN' || user.username === 'superadmin' || user.username === 'admin';
  if (isSuper) return null;
  return user.companyId !== undefined && user.companyId !== null ? user.companyId : null;
}

export function getTenantFilter(req: Request): { companyId?: number } {
  let user = (req as AuthenticatedRequest).user;
  if (!user && req.headers.authorization?.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      user = jwt.verify(token, JWT_SECRET) as any;
      (req as AuthenticatedRequest).user = user;
    } catch (e) {}
  }
  if (!user) return { companyId: -1 };
  const isSuper = user.role === 'SUPER_ADMIN' || user.username === 'superadmin' || user.username === 'admin';
  if (isSuper) return {};
  if (user.companyId !== undefined && user.companyId !== null) {
    return { companyId: user.companyId };
  }
  return { companyId: -1 };
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.username === 'superadmin' || req.user.username === 'admin';
  if (!isSuper) {
    return res.status(403).json({ error: 'Access Denied: Super Administrator privileges required' });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  const isAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN' || req.user.isAdmin || req.user.username === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Access Denied: Admin privileges required' });
  }
  next();
}

export function requirePermission(pageRoute: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // If user not already populated, try parsing authorization header
    if (!req.user) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          req.user = decoded;
        } catch (error) {
          return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
      }
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'ADMIN' ||
      req.user.isAdmin ||
      req.user.username === 'admin'
    ) {
      return next();
    }

    try {
      const permission = await prisma.userPermission.findFirst({
        where: {
          employeeRecId: req.user.id,
          pageRoute: pageRoute
        }
      });

      if (!permission || !permission.isAllowed) {
        return res.status(403).json({
          error: `Access Denied: You do not have permission to access module '${pageRoute}'`
        });
      }

      next();
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to verify user permissions' });
    }
  };
}

