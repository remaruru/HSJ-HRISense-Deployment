import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { randomUUID } from 'crypto';

interface TokenPayload {
  userId: string;
  email: string;
  roleCode: string;
  permissionTier: string;
  employeeId?: string;
}

export const signAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const signRefreshToken = (payload: { userId: string }): string => {
  // `jti` gives every refresh token its own identity.
  //
  // Without it the payload is only { userId, iat, exp }, and iat/exp have
  // one-second resolution — so two logins by the same user inside the same
  // second produced BYTE-IDENTICAL tokens. `user_sessions.refreshToken` is
  // unique, so the second login failed on a P2002 constraint violation
  // (a double-clicked sign-in, or signing in on two devices at once).
  return jwt.sign(
    { ...payload, jti: randomUUID() },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as { userId: string };
};
