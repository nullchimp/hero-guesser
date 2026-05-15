import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppConfigService } from "../config/app-config.service.js";
import {
  AuthenticatedRequest,
  AuthUser,
  JwtPayload
} from "./auth.types.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);

    if (token === undefined) {
      throw new UnauthorizedException("Authentication required.");
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        algorithms: [
          "HS256"
        ],
        secret: this.config.jwtSecret
      });
      const user = readAuthUser(payload);

      if (user === null) {
        throw new UnauthorizedException("Invalid authentication token.");
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired authentication token.");
    }
  }
}

function extractBearerToken(request: AuthenticatedRequest): string | undefined {
  const header = request.headers.authorization;

  if (typeof header !== "string") {
    return undefined;
  }

  const [type, token] = header.split(" ");

  if (type !== "Bearer" || token === undefined || token.trim().length === 0) {
    return undefined;
  }

  return token;
}

function readAuthUser(payload: JwtPayload): AuthUser | null {
  if (typeof payload.sub !== "string" || typeof payload.heroname !== "string") {
    return null;
  }

  return {
    heroname: payload.heroname,
    id: payload.sub
  };
}
