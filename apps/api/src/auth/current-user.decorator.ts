import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException
} from "@nestjs/common";
import {
  AuthenticatedRequest,
  AuthUser
} from "./auth.types.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user === undefined) {
      throw new UnauthorizedException("Authentication required.");
    }

    return request.user;
  }
);
