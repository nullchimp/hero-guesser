import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { AppConfigService } from "../config/app-config.service.js";
import { AuthRepository, UserRecord } from "./auth.repository.js";
import {
  AuthSessionResponse,
  AuthUser,
  JwtPayload
} from "./auth.types.js";
import {
  assertValidPassword,
  normalizeHeroname
} from "./auth.validation.js";
import {
  hashPassword,
  verifyPassword
} from "./password-hashing.js";

interface AuthCredentials {
  heroname: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService
  ) {}

  async register(input: AuthCredentials): Promise<AuthSessionResponse> {
    const heroname = normalizeHeroname(input.heroname);
    assertValidPassword(input.password);

    const existingUser = await this.repository.getUserByHeronameKey(heroname.heronameKey);

    if (existingUser !== null) {
      throw new ConflictException("That heroname is already taken.");
    }

    try {
      const user = await this.repository.createUser({
        heroname: heroname.heroname,
        heronameKey: heroname.heronameKey,
        passwordHash: await hashPassword(input.password)
      });

      return this.toAuthSession(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("That heroname is already taken.");
      }

      throw error;
    }
  }

  async login(input: AuthCredentials): Promise<AuthSessionResponse> {
    const heroname = normalizeHeroname(input.heroname);
    assertValidPassword(input.password);

    const user = await this.repository.getUserByHeronameKey(heroname.heronameKey);

    if (user === null || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid heroname or password.");
    }

    return this.toAuthSession(user);
  }

  private async toAuthSession(user: UserRecord): Promise<AuthSessionResponse> {
    const authUser = toAuthUser(user);
    const payload: JwtPayload = {
      heroname: authUser.heroname,
      sub: authUser.id
    };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.config.jwtExpiresIn,
      secret: this.config.jwtSecret
    });

    return {
      token,
      user: authUser
    };
  }
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    heroname: user.heroname,
    id: user.id
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
