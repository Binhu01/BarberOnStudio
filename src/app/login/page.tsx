"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bo-black px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-bo-border bg-bo-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-bo-blue text-white shadow-[0_0_20px_rgba(8,102,232,0.3)]">
            <Scissors className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold text-bo-white">
            Entrar no Barber-On
          </h1>
          <p className="mt-2 text-sm text-bo-gray">
            Acesse sua conta para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-bo-gray"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              {...register("email")}
              className="w-full rounded-lg border border-bo-border bg-bo-graphite px-4 py-2.5 text-sm text-bo-white placeholder:text-bo-gray/50 outline-none transition-colors focus:border-bo-blue focus:ring-1 focus:ring-bo-blue"
              placeholder="seu@email.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-bo-gray"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              {...register("password")}
              className="w-full rounded-lg border border-bo-border bg-bo-graphite px-4 py-2.5 text-sm text-bo-white placeholder:text-bo-gray/50 outline-none transition-colors focus:border-bo-blue focus:ring-1 focus:ring-bo-blue"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-bo-blue py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(8,102,232,0.3)] transition-all hover:bg-blue-600 hover:shadow-[0_0_25px_rgba(8,102,232,0.4)] disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="text-center text-sm text-bo-gray">
          Não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-bo-blue-bright hover:text-bo-blue hover:underline"
          >
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}