import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function authError(
  message: string,
  status = 400,
  fieldErrors?: Record<string, string[] | undefined>,
) {
  return NextResponse.json(
    {
      message,
      fieldErrors,
    },
    { status },
  );
}

export function authValidationError(error: ZodError) {
  return authError(
    "Revise os campos destacados e tente novamente.",
    400,
    error.flatten().fieldErrors,
  );
}
