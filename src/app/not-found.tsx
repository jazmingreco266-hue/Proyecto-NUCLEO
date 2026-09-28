import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login">
      <div className="empty">
        <h3>No encontramos esa página</h3>
        <p>Puede que el prospecto haya sido retirado o que el enlace esté incompleto.</p>
        <Link className="btn" href="/panel">
          Ir a la vista general
        </Link>
      </div>
    </main>
  );
}
