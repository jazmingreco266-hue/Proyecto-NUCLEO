import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { countUsers } from "@/server/services/users";
import { Wordmark } from "../ui/brand";
import { FirstOwnerForm } from "./form";

export const metadata: Metadata = { title: "Configuración inicial" };

/** Solo existe mientras el panel no tiene ningún usuario. */
export default async function FirstSetup() {
  if ((await countUsers(getDb())) > 0) notFound();
  return (
    <main className="login">
      <div className="login-card panel">
        <div className="brand">
          <Wordmark sub="Configuración inicial" />
        </div>
        <p className="muted">
          Creá la cuenta de propietario. Esta página desaparece apenas exista el primer usuario.
        </p>
        <FirstOwnerForm />
      </div>
    </main>
  );
}
