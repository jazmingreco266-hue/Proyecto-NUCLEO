import emailjs from '@emailjs/browser'

/**
 * Envío de mails 100% desde el cliente vía EmailJS (no hay backend propio).
 * Si las variables no están configuradas, no rompe nada: solo no manda el
 * mail y lo avisa por consola. Ver README para el setup paso a paso.
 */
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const emailConfigured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

export async function sendWelcomeEmail(params: { toName: string; toEmail: string }): Promise<boolean> {
  if (!emailConfigured) {
    console.info(
      '[Núcleo] No se envió el mail de bienvenida: EmailJS no está configurado todavía (ver README, sección "Activar el mail de confirmación").',
    )
    return false
  }
  try {
    await emailjs.send(
      SERVICE_ID!,
      TEMPLATE_ID!,
      {
        to_name: params.toName,
        to_email: params.toEmail,
        app_name: 'Núcleo',
      },
      { publicKey: PUBLIC_KEY! },
    )
    return true
  } catch (err) {
    console.error('[Núcleo] No se pudo enviar el mail de bienvenida', err)
    return false
  }
}
