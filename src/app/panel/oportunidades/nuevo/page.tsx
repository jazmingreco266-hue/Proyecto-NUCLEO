import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";
import { NewProspectForm } from "../forms";

export const metadata: Metadata = { title: "Cargar prospecto" };

export default async function NewProspect() {
  await requireUser("prospects.write");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cargar prospecto</h1>
          <p>
            Registrá una empresa real que encontraste. Si el dominio ya está cargado, el panel te avisa para no
            duplicarla.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/panel/oportunidades">
          Volver
        </Link>
      </div>
      <div className="panel">
        <NewProspectForm />
      </div>
    </>
  );
}
