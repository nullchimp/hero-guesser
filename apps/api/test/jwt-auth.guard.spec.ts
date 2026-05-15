import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { AppConfigService } from "../src/config/app-config.service.js";
import { AuthenticatedRequest } from "../src/auth/auth.types.js";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard.js";

const JWT_SECRET = "test-jwt-secret-that-is-long-enough-for-signing";
const JWT_EXPIRES_IN = "7d" as JwtSignOptions["expiresIn"];

describe("JwtAuthGuard", () => {
  it("accepts a valid bearer token and attaches the authenticated user", async () => {
    const jwt = new JwtService({
      secret: JWT_SECRET,
      signOptions: {
        expiresIn: JWT_EXPIRES_IN
      }
    });
    const token = await jwt.signAsync({
      heroname: "ShadowFox",
      sub: "user-1"
    });
    const { context, request } = contextFor(`Bearer ${token}`);
    const guard = createGuard(jwt);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      heroname: "ShadowFox",
      id: "user-1"
    });
  });

  it("rejects missing, malformed, and invalid bearer tokens", async () => {
    const guard = createGuard(new JwtService({
      secret: JWT_SECRET
    }));

    await expect(guard.canActivate(contextFor().context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(contextFor("Token abc").context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(contextFor("Bearer invalid").context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createGuard(jwt: JwtService): JwtAuthGuard {
  return new JwtAuthGuard(
    jwt,
    {
      jwtSecret: JWT_SECRET
    } as AppConfigService
  );
}

function contextFor(authorization?: string): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const request = {
    headers: authorization === undefined ? {} : {
      authorization
    }
  } as AuthenticatedRequest;

  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as unknown as ExecutionContext,
    request
  };
}
