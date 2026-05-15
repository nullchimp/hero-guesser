import type { Request } from "express";

export interface AuthUser {
  heroname: string;
  id: string;
}

export interface JwtPayload {
  exp?: number;
  heroname: string;
  iat?: number;
  sub: string;
}

export interface AuthSessionResponse {
  token: string;
  user: AuthUser;
}

export interface AuthUserResponse {
  user: AuthUser;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
