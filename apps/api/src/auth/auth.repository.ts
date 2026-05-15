import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export interface UserRecord {
  createdAt: Date;
  heroname: string;
  heronameKey: string;
  id: string;
  passwordHash: string;
  updatedAt: Date;
}

interface CreateUserInput {
  heroname: string;
  heronameKey: string;
  passwordHash: string;
}

interface PrismaUser {
  createdAt: Date;
  heroname: string;
  heronameKey: string;
  id: string;
  passwordHash: string;
  updatedAt: Date;
}

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
}

function mapUser(user: PrismaUser): UserRecord {
  return {
    createdAt: user.createdAt,
    heroname: user.heroname,
    heronameKey: user.heronameKey,
    id: user.id,
    passwordHash: user.passwordHash,
    updatedAt: user.updatedAt
  };
}
