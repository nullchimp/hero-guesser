import { IsIn } from "class-validator";
import type { PlayerAnswer } from "../conversation.types.js";

const ANSWERS: PlayerAnswer[] = [
  "yes",
  "no",
  "unknown"
];

export class SubmitAnswerDto {
  @IsIn(ANSWERS)
  answer!: PlayerAnswer;
}
