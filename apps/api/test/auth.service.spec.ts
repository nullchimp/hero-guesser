import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { AppConfigService } from "../src/config/app-config.service.js";
import { AuthRepository, UserRecord } from "../src/auth/auth.repository.js";
import { AuthService } from "../src/auth/auth.service.js";
import { JwtPayload } from "../src/auth/auth.types.js";

const JWT_SECRET = "test-jwt-secret-that-is-long-enough-for-signing";
const JWT_EXPIRES_IN = "7d" as JwtSignOptions["expiresIn"];

describe("AuthService", () => {
  it("registers a heroname, stores a password hash, and returns a signed token", async () => {
    const repository = new FakeAuthRepository();
    const service = createService(repository);

    const result = await service.register({
      heroname: "  ShadowFox  ",
      password: "secret123"
    });

    expect(result.user).toEqual({
      heroname: "ShadowFox",
      id: "user-1"
    });
    expect(repository.users[0]).toMatchObject({
      heroname: "ShadowFox",
      heronameKey: "shadowfox"
    });
    expect(repository.users[0].passwordHash).not.toBe("secret123");
    await expect(verifyToken(result.token)).resolves.toMatchObject({
      heroname: "ShadowFox",
      sub: "user-1"
    });
  });

  it("rejects duplicate heronames case-insensitively", async () => {
    const repository = new FakeAuthRepository();
    const service = createService(repository);

    await service.register({
      heroname: "ShadowFox",
      password: "secret123"
    });

    await expect(service.register({
      heroname: "shadowfox",
      password: "secret456"
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in with valid credentials", async () => {
    const repository = new FakeAuthRepository();
    const service = createService(repository);

    await service.register({
      heroname: "Night_Signal",
      password: "secret123"
    });

    const result = await service.login({
      heroname: "night_signal",
      password: "secret123"
    });

    expect(result.user).toEqual({
      heroname: "Night_Signal",
      id: "user-1"
    });
    await expect(verifyToken(result.token)).resolves.toMatchObject({
      heroname: "Night_Signal",
      sub: "user-1"
    });
  });

  it("rejects unknown heronames and wrong passwords", async () => {
    const repository = new FakeAuthRepository();
    const service = createService(repository);

    await service.register({
      heroname: "ShadowFox",
      password: "secret123"
    });

    await expect(service.login({
      heroname: "MissingHero",
      password: "secret123"
    })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login({
      heroname: "ShadowFox",
      password: "wrongpass"
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("validates heroname and password rules", async () => {
    const service = createService(new FakeAuthRepository());

    await expect(service.register({
      heroname: "hero name",
      password: "secret123"
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.register({
      heroname: "Hero",
      password: "short"
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});

function createService(repository: FakeAuthRepository): AuthService {
  return new AuthService(
    repository as unknown as AuthRepository,
    new JwtService({
      secret: JWT_SECRET,
      signOptions: {
        expiresIn: JWT_EXPIRES_IN
      }
    }),
    {
      jwtExpiresIn: JWT_EXPIRES_IN,
      jwtSecret: JWT_SECRET
    } as AppConfigService
  );
}

async function verifyToken(token: string): Promise<JwtPayload> {
  return new JwtService({
    secret: JWT_SECRET
  }).verifyAsync<JwtPayload>(token);
}

class FakeAuthRepository {
  readonly users: UserRecord[] = [];

  async createUser(input: {
    heroname: string;
    heronameKey: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const user: UserRecord = {
      createdAt: new Date("2026-05-15T12:00:00.000Z"),
      heroname: input.heroname,
      heronameKey: input.heronameKey,
      id: `user-${this.users.length + 1}`,
      passwordHash: input.passwordHash,
      updatedAt: new Date("2026-05-15T12:00:00.000Z")
    };

    this.users.push(user);
    return user;
  }

  async getUserByHeronameKey(heronameKey: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.heronameKey === heronameKey) ?? null;
  }
}
