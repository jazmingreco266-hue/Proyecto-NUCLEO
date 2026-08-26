import { LegalShell } from './LegalShell'

const LAST_UPDATED = '26 de agosto de 2026'

export default function PrivacyPolicy() {
  return (
    <LegalShell title="Política de privacidad" subtitle={`Última actualización: ${LAST_UPDATED}`}>
      <p>
        Esta política explica qué información maneja Núcleo, cómo se guarda y qué derechos tenés
        sobre ella. Está escrita en un lenguaje simple a propósito: si algo no queda claro,
        escribinos (ver "Contacto" al final).
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">1. Qué es Núcleo</h2>
      <p>
        Núcleo es una aplicación de organización y acompañamiento para personas que atraviesan un
        proceso oncológico y sus familias. No diagnostica, no interpreta estudios clínicos y no
        reemplaza a un equipo médico.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">2. Dónde vive tu información</h2>
      <p>
        En esta versión, Núcleo guarda toda tu información <strong>únicamente en tu propio
        dispositivo</strong> (en el almacenamiento local del navegador o de la app). No existe un
        servidor central de Núcleo que reciba o almacene copias de tus datos de salud. Esto
        significa que nosotros, como equipo detrás de la app, no tenemos acceso a lo que
        registrás.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">3. Qué datos se recopilan</h2>
      <p>Según cómo uses la app, puede incluir:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Datos de cuenta: nombre, email y, si elegís "Continuar con Google", tu nombre y foto de perfil de Google.</li>
        <li>Datos de salud autoinformados: síntomas, ánimo, medicación, turnos, tratamiento y notas que vos mismo/a cargues.</li>
        <li>Documentos y fotos que subas (recetas, estudios, imágenes personales).</li>
        <li>Información técnica básica del dispositivo, necesaria para que la app funcione (por ejemplo, preferencias guardadas localmente).</li>
      </ul>
      <p>
        No recopilamos datos con fines publicitarios, no usamos rastreadores de terceros y no
        vendemos ni alquilamos información a nadie.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">4. Inicio de sesión con Google</h2>
      <p>
        Si usás "Continuar con Google", Google comparte con la app tu nombre, email y foto de
        perfil para identificarte. Núcleo no accede a tu contraseña de Google ni a otra
        información de tu cuenta de Google.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">5. Círculo familiar</h2>
      <p>
        Si invitás a un familiar con tu código de acceso, esa persona podrá ver la información que
        vos habilites según los permisos que configures en la sección Círculo. Podés revisar y
        cambiar esos permisos, o quitar a una persona, en cualquier momento.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">6. Tus derechos</h2>
      <p>
        En Argentina, tus datos de salud son "datos sensibles" bajo la Ley 25.326 de Protección de
        Datos Personales. Tenés derecho a acceder, rectificar y solicitar la eliminación de tu
        información en cualquier momento. Dentro de la app, en Privacidad, podés:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Descargar una copia completa de tus datos (formato JSON).</li>
        <li>Eliminar tu cuenta y los datos asociados de forma permanente.</li>
        <li>Activar un PIN adicional para proteger el acceso en tu dispositivo.</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-ink-900">7. Seguridad</h2>
      <p>
        Las contraseñas se guardan con hash (no en texto plano) en tu dispositivo. Como esta
        versión no tiene un servidor propio, la seguridad de tus datos depende en gran parte de la
        seguridad de tu propio dispositivo: te recomendamos activar el PIN de la app y mantener tu
        celular u computadora protegidos con su propio bloqueo.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">8. Menores de edad</h2>
      <p>
        Núcleo no está dirigida a niños. Si un adolescente participa como paciente o familiar,
        debe hacerlo con el conocimiento de un adulto responsable.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">9. Cambios a esta política</h2>
      <p>
        Si actualizamos esta política, vamos a cambiar la fecha de "última actualización" en la
        parte de arriba. Cambios importantes se van a comunicar dentro de la app.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">10. Contacto</h2>
      <p>
        Ante cualquier consulta sobre privacidad o tus datos, escribinos a{' '}
        <a href="mailto:soporte@nucleoapp.com.ar" className="font-semibold text-lavender-600 hover:underline">
          soporte@nucleoapp.com.ar
        </a>
        .
      </p>
    </LegalShell>
  )
}
