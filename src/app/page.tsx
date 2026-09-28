import { redirect } from "next/navigation";

// Esta aplicación es solo el panel operativo. La web promocional vive en otro lado y no se toca.
export default function Home() {
  redirect("/panel");
}
