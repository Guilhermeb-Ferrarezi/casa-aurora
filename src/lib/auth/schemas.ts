import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .email("Digite um e-mail valido.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter no minimo 8 caracteres.")
  .max(72, "A senha precisa ter no maximo 72 caracteres.");

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Digite seu nome completo.")
      .max(80, "Use um nome com ate 80 caracteres.")
      .transform((value) => value.replace(/\s+/g, " ")),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
