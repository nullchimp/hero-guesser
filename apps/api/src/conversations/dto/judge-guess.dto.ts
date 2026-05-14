import { IsIn } from "class-validator";
import type { GuessVerdict } from "../conversation.types.js";

const VERDICTS: GuessVerdict[] = [
  "correct",
  "wrong"
];

export class JudgeGuessDto {
  @IsIn(VERDICTS)
  verdict!: GuessVerdict;
}
