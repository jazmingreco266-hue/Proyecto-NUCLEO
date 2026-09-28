import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentPrincipal } from "@/server/auth/current";
import { BrandMark } from "../ui/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await currentPrincipal()) redirect("/panel");
  return (
    <main className="login">
      <div className="login-card panel">
        <div className="brand">
          <BrandMark />
          <span>
            Claude Workers
            <small>Panel operativo</small>
          </span>
        </div>
        <LoginForm />
        <p className="faint">Acceso privado. Las cuentas se crean desde la consola del servidor.</p>
      </div>
    </main>
  );
}
