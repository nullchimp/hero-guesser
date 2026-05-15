import { BadRequestException } from "@nestjs/common";

export const HERONAME_MIN_LENGTH = 3;
export const HERONAME_MAX_LENGTH = 24;
export const PASSWORD_MIN_LENGTH = 8;
export const HERONAME_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface NormalizedHeroname {
  heroname: string;
  heronameKey: string;
}

export function normalizeHeroname(value: string): NormalizedHeroname {
  const heroname = value.trim();

  if (heroname.length < HERONAME_MIN_LENGTH || heroname.length > HERONAME_MAX_LENGTH) {
    throw new BadRequestException(
      `Heroname must be between ${HERONAME_MIN_LENGTH} and ${HERONAME_MAX_LENGTH} characters.`
    );
  }

  if (!HERONAME_PATTERN.test(heroname)) {
    throw new BadRequestException("Heroname can only use letters, numbers, underscores, and hyphens.");
  }

  return {
    heroname,
    heronameKey: heroname.toLowerCase()
  };
}

export function assertValidPassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new BadRequestException(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
}
