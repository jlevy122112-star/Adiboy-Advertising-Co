import { Request } from 'express';

// Authenticated request — req.user is attached by authGuard middleware
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    workspaceId: string;
    role: string;
    email: string;
  };
}

// Standard API response shape
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}
