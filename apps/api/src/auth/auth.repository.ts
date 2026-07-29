import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { GitHubIdentity } from "./auth.types.js";

export interface UserRecord {
  createdAt: Date;
  githubId: string | null;
  githubLogin: string | null;
  heroname: string;
  heronameKey: string;
  id: string;
  passwordHash: string | null;
  updatedAt: Date;
}

interface CreateUserInput {
  heroname: string;
  heronameKey: string;
  passwordHash: string | null;
}

interface PrismaUser {
  createdAt: Date;
  githubId: string | null;
  githubLogin: string | null;
  heroname: string;
  heronameKey: string;
  id: string;
  passwordHash: string | null;
  updatedAt: Date;
}

export class GitHubIdentityConflictError extends Error {}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        heroname: input.heroname,
        heronameKey: input.heronameKey,
        passwordHash: input.passwordHash
      }
    });

    return mapUser(user);
  }

  async getUserByHeronameKey(heronameKey: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        heronameKey
      }
    });

    return user === null ? null : mapUser(user);
  }

  async resolveGitHubUser(identity: GitHubIdentity): Promise<UserRecord> {
    try {
      return await this.resolveGitHubUserTransaction(identity);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    try {
      return await this.resolveGitHubUserTransaction(identity);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new GitHubIdentityConflictError(
          "The GitHub username is already associated with another local account."
        );
      }

      throw error;
    }
  }

  private async resolveGitHubUserTransaction(identity: GitHubIdentity): Promise<UserRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const linkedUser = await transaction.user.findUnique({
        where: {
          githubId: identity.id
        }
      });

      if (linkedUser !== null) {
        const matchingName = await transaction.user.findUnique({
          where: {
            heronameKey: identity.loginKey
          }
        });

        if (matchingName !== null && matchingName.id !== linkedUser.id) {
          throw new GitHubIdentityConflictError(
            "The current GitHub username conflicts with another local account."
          );
        }

        const updated = await transaction.user.update({
          data: {
            githubLogin: identity.login,
            heroname: identity.login,
            heronameKey: identity.loginKey
          },
          where: {
            id: linkedUser.id
          }
        });

        return mapUser(updated);
      }

      const matchingUser = await transaction.user.findUnique({
        where: {
          heronameKey: identity.loginKey
        }
      });

      if (matchingUser !== null) {
        if (matchingUser.githubId !== null && matchingUser.githubId !== identity.id) {
          throw new GitHubIdentityConflictError(
            "The GitHub username is already associated with another local account."
          );
        }

        const linked = await transaction.user.update({
          data: {
            githubId: identity.id,
            githubLogin: identity.login,
            heroname: identity.login
          },
          where: {
            id: matchingUser.id
          }
        });

        return mapUser(linked);
      }

      const created = await transaction.user.create({
        data: {
          githubId: identity.id,
          githubLogin: identity.login,
          heroname: identity.login,
          heronameKey: identity.loginKey,
          passwordHash: null
        }
      });

      return mapUser(created);
    });
  }
}

function mapUser(user: PrismaUser): UserRecord {
  return {
    createdAt: user.createdAt,
    githubId: user.githubId,
    githubLogin: user.githubLogin,
    heroname: user.heroname,
    heronameKey: user.heronameKey,
    id: user.id,
    passwordHash: user.passwordHash,
    updatedAt: user.updatedAt
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
