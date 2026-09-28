import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { countUsers } from "@/server/services/users";
import { Wordmark } from "../ui/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await currentPrincipal()) redirect("/panel");
  const firstRun = (await countUsers(getDb())) === 0;
  return (
    <main className="login">
      <div className="login-card panel">
        <div className="brand">
          <Wordmark />
        </div>
        <LoginForm />
        {firstRun ? (
          <p className="notice">
            Todavía no hay usuarios. <Link href="/configuracion-inicial">Crear la cuenta de propietario</Link>
          </p>
        ) : (
          <p className="faint">Acceso privado. Las cuentas nuevas las crea el propietario desde Usuarios.</p>
        )}
      </div>
    </main>
  );
}
