"use client";

import { useState } from "react";
import { FONT_NAMES } from "@/domain/brand";
import { CHANNEL_LABELS, TRATOS, type AssetMeta, type SiteBrand, type SiteContent } from "@/domain/site";
import { ActionForm } from "../../ui/action-form";
import { buildSiteAction, requestSiteCopyAction, saveBriefAction, uploadBrandAssetAction } from "./actions";

// ─────────────────────────── Imágenes ───────────────────────────

export function BrandAssetForm({ prospectId }: { prospectId: string }) {
  const [kind, setKind] = useState<"logo" | "foto">("logo");
  return (
    <ActionForm action={uploadBrandAssetAction} submitLabel="Subir imagen" pendingLabel="Subiendo…" submitClass="btn">
      {() => (
        <>
          <input type="hidden" name="prospectId" value={prospectId} />
          <div className="form-grid">
            <label className="field">
              <span>Tipo</span>
              <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "logo" | "foto")}>
                <option value="logo">Logo</option>
                <option value="foto">Foto del negocio</option>
              </select>
            </label>
            <label className="field">
              <span>Archivo (PNG, JPG o WebP, hasta 3 MB)</span>
              <input name="archivo" type="file" accept="image/png,image/jpeg,image/webp" required />
              <small>SVG no se acepta por seguridad: pedile al cliente el logo en PNG, idealmente con fondo transparente.</small>
            </label>
            {kind === "foto" && (
              <label className="field field-wide">
                <span>¿Qué se ve en la foto? *</span>
                <input name="alt" maxLength={200} required placeholder="Ej.: Mostrador con panes recién horneados" />
                <small>Se usa para personas con lector de pantalla y para buscadores.</small>
              </label>
            )}
          </div>
        </>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Ficha ───────────────────────────

type Brief = { brand: SiteBrand; content: SiteContent; authorizationNote: string };

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function BriefEditor({ prospectId, initial, assets }: { prospectId: string; initial: Brief; assets: AssetMeta[] }) {
  const [b, setB] = useState(initial);
  const [social, setSocial] = useState(initial.content.social.map((s) => `${s.label} | ${s.url}`).join("\n"));
  const [highlights, setHighlights] = useState(initial.content.highlights.join("\n"));
  const logos = assets.filter((a) => a.kind === "logo");
  const photos = assets.filter((a) => a.kind === "foto");

  const brand = (patch: Partial<SiteBrand>) => setB((x) => ({ ...x, brand: { ...x.brand, ...patch } }));
  const colors = (patch: Partial<SiteBrand["colors"]>) => brand({ colors: { ...b.brand.colors, ...patch } });
  const content = (patch: Partial<SiteContent>) => setB((x) => ({ ...x, content: { ...x.content, ...patch } }));
  const contact = (patch: Partial<SiteContent["contact"]>) => content({ contact: { ...b.content.contact, ...patch } });
  const service = (i: number, patch: Partial<SiteContent["services"][number]>) =>
    content({ services: b.content.services.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const payload = JSON.stringify({
    prospectId,
    authorizationNote: b.authorizationNote,
    brand: b.brand,
    content: {
      ...b.content,
      highlights: lines(highlights),
      social: lines(social).map((l) => {
        const [label = "", ...rest] = l.split("|");
        return { label: label.trim(), url: rest.join("|").trim() };
      }),
    },
  });

  const c = b.content;
  return (
    <ActionForm action={saveBriefAction} submitLabel="Guardar ficha (nueva versión)">
      {() => (
        <>
          <input type="hidden" name="brief" value={payload} />

          <fieldset>
            <legend>Autorización del cliente</legend>
            <label className="field">
              <span>¿Cómo te autorizó a usar su marca, logo y fotos? *</span>
              <input
                value={b.authorizationNote}
                onChange={(e) => setB({ ...b, authorizationNote: e.target.value })}
                maxLength={500}
                placeholder="Ej.: Aceptó el presupuesto N.º 12 y mandó logo y fotos por mail el 30/09"
              />
              <small>Queda registrado. Solo se usan materiales que el cliente entregó o aprobó.</small>
            </label>
          </fieldset>

          <fieldset>
            <legend>Identidad visual</legend>
            <div className="form-grid">
              {(
                [
                  ["primary", "Color principal (de su logo)"],
                  ["background", "Color de fondo"],
                  ["text", "Color del texto"],
                ] as const
              ).map(([k, label]) => (
                <label className="field" key={k}>
                  <span>{label}</span>
                  <span className="color-field">
                    <input type="color" value={b.brand.colors[k]} onChange={(e) => colors({ [k]: e.target.value })} aria-label={`${label}: selector`} />
                    <input value={b.brand.colors[k]} onChange={(e) => colors({ [k]: e.target.value })} maxLength={7} pattern="#[0-9a-fA-F]{6}" aria-label={`${label}: código`} />
                  </span>
                </label>
              ))}
              <label className="field">
                <span>Color secundario (opcional)</span>
                <span className="color-field">
                  <input type="color" value={b.brand.colors.secondary ?? "#000000"} onChange={(e) => colors({ secondary: e.target.value })} aria-label="Color secundario: selector" />
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => colors({ secondary: null })} disabled={!b.brand.colors.secondary}>
                    {b.brand.colors.secondary ? "Quitar" : "Sin color"}
                  </button>
                </span>
              </label>
              <label className="field">
                <span>Fuente de títulos</span>
                <select value={b.brand.headingFont} onChange={(e) => brand({ headingFont: e.target.value as SiteBrand["headingFont"] })}>
                  {FONT_NAMES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Fuente de textos</span>
                <select value={b.brand.bodyFont} onChange={(e) => brand({ bodyFont: e.target.value as SiteBrand["bodyFont"] })}>
                  {FONT_NAMES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <small>Si el cliente tiene manual de marca, usá sus fuentes o la más parecida.</small>
              </label>
            </div>
            <div className="field">
              <span>Logo</span>
              {logos.length === 0 ? (
                <small>Todavía no subiste un logo. Sin logo se muestra el nombre con la fuente de títulos.</small>
              ) : (
                <div className="asset-pick">
                  <label>
                    <input type="radio" name="logo-pick" checked={!b.brand.logoId} onChange={() => brand({ logoId: null })} /> Sin logo
                  </label>
                  {logos.map((a) => (
                    <label key={a.id}>
                      <input type="radio" name="logo-pick" checked={b.brand.logoId === a.id} onChange={() => brand({ logoId: a.id })} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/marca/${a.id}`} alt={`Logo ${a.width}×${a.height}`} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>Textos</legend>
            <p className="faint">
              Usá lo que te dio el cliente. Si falta algo, preguntale: el sitio no inventa datos, cifras ni testimonios.
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Nombre del negocio *</span>
                <input value={c.businessName} onChange={(e) => content({ businessName: e.target.value })} maxLength={80} />
              </label>
              <label className="field">
                <span>Trato al lector</span>
                <select value={c.trato} onChange={(e) => content({ trato: e.target.value as SiteContent["trato"] })}>
                  {TRATOS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field field-wide">
                <span>Frase principal * ({c.tagline.length}/90)</span>
                <input value={c.tagline} onChange={(e) => content({ tagline: e.target.value })} maxLength={90} placeholder="Qué hacen y para quién, en una línea" />
              </label>
              <label className="field field-wide">
                <span>Introducción ({c.intro.length}/240)</span>
                <textarea rows={2} value={c.intro} onChange={(e) => content({ intro: e.target.value })} maxLength={240} />
              </label>
              <label className="field field-wide">
                <span>Nosotros ({c.about.length}/1500)</span>
                <textarea rows={5} value={c.about} onChange={(e) => content({ about: e.target.value })} maxLength={1500} placeholder="Historia, equipo, cómo trabajan. Separá párrafos con una línea en blanco." />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Servicios ({c.services.length}/9)</legend>
            {c.services.map((s, i) => (
              <div className="form-grid service-row" key={i}>
                <label className="field">
                  <span>Servicio {i + 1}</span>
                  <input value={s.title} onChange={(e) => service(i, { title: e.target.value })} maxLength={60} />
                </label>
                <label className="field">
                  <span>Descripción</span>
                  <textarea rows={2} value={s.description} onChange={(e) => service(i, { description: e.target.value })} maxLength={320} />
                </label>
                {c.services.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => content({ services: c.services.filter((_, j) => j !== i) })}>
                    Quitar
                  </button>
                )}
              </div>
            ))}
            {c.services.length < 9 && (
              <button type="button" className="btn btn-small" onClick={() => content({ services: [...c.services, { title: "", description: "" }] })}>
                Agregar servicio
              </button>
            )}
            <label className="field">
              <span>Por qué elegirlos (uno por línea, hasta 6; opcional)</span>
              <textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="Solo cosas que el cliente pueda sostener" />
            </label>
          </fieldset>

          <fieldset>
            <legend>Contacto y botón</legend>
            <div className="form-grid">
              <label className="field">
                <span>WhatsApp (con código de país)</span>
                <input value={c.contact.whatsapp} onChange={(e) => contact({ whatsapp: e.target.value.replace(/\D/g, "") })} inputMode="numeric" maxLength={15} placeholder="5491122334455" />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input value={c.contact.phone} onChange={(e) => contact({ phone: e.target.value })} maxLength={40} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={c.contact.email} onChange={(e) => contact({ email: e.target.value })} maxLength={120} />
              </label>
              <label className="field">
                <span>Dirección</span>
                <input value={c.contact.address} onChange={(e) => contact({ address: e.target.value })} maxLength={200} />
              </label>
              <label className="field">
                <span>Link al mapa (opcional)</span>
                <input type="url" value={c.contact.mapUrl} onChange={(e) => contact({ mapUrl: e.target.value })} maxLength={500} placeholder="https://maps.google.com/…" />
              </label>
              <label className="field">
                <span>Horarios</span>
                <input value={c.contact.hours} onChange={(e) => contact({ hours: e.target.value })} maxLength={200} placeholder="Lunes a viernes de 9 a 18" />
              </label>
              <label className="field">
                <span>Texto del botón principal</span>
                <input value={c.cta.label} onChange={(e) => content({ cta: { ...c.cta, label: e.target.value } })} maxLength={30} />
              </label>
              <label className="field">
                <span>El botón lleva a</span>
                <select value={c.cta.channel} onChange={(e) => content({ cta: { ...c.cta, channel: e.target.value as SiteContent["cta"]["channel"] } })}>
                  {Object.entries(CHANNEL_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field-wide">
                <span>Redes (una por línea: Nombre | dirección)</span>
                <textarea rows={2} value={social} onChange={(e) => setSocial(e.target.value)} placeholder="Instagram | https://instagram.com/…" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Fotos</legend>
            {photos.length === 0 ? (
              <p className="faint">Sin fotos cargadas. Fotos reales del negocio hacen mucho más creíble el sitio.</p>
            ) : (
              <>
                <div className="field">
                  <span>Foto de portada</span>
                  <div className="asset-pick">
                    <label>
                      <input type="radio" name="hero-pick" checked={!c.heroPhotoId} onChange={() => content({ heroPhotoId: null })} /> Sin foto
                    </label>
                    {photos.map((a) => (
                      <label key={a.id}>
                        <input type="radio" name="hero-pick" checked={c.heroPhotoId === a.id} onChange={() => content({ heroPhotoId: a.id, galleryIds: c.galleryIds.filter((g) => g !== a.id) })} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/marca/${a.id}`} alt={a.alt} />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span>Otras fotos (Nosotros y galería)</span>
                  <div className="asset-pick">
                    {photos
                      .filter((a) => a.id !== c.heroPhotoId)
                      .map((a) => (
                        <label key={a.id}>
                          <input
                            type="checkbox"
                            checked={c.galleryIds.includes(a.id)}
                            onChange={(e) => content({ galleryIds: e.target.checked ? [...c.galleryIds, a.id] : c.galleryIds.filter((g) => g !== a.id) })}
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/marca/${a.id}`} alt={a.alt} />
                        </label>
                      ))}
                  </div>
                </div>
              </>
            )}
          </fieldset>

          <fieldset>
            <legend>Buscadores</legend>
            <div className="form-grid">
              <label className="field field-wide">
                <span>Descripción para Google ({c.seoDescription.length}/160)</span>
                <textarea rows={2} value={c.seoDescription} onChange={(e) => content({ seoDescription: e.target.value })} maxLength={160} />
              </label>
              <label className="field">
                <span>Dominio final (opcional)</span>
                <input value={c.domain} onChange={(e) => content({ domain: e.target.value })} maxLength={100} placeholder="minegocio.com.ar" />
              </label>
            </div>
          </fieldset>
        </>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Acciones ───────────────────────────

export function BuildSiteForm({ prospectId }: { prospectId: string }) {
  return (
    <ActionForm action={buildSiteAction} submitLabel="Generar sitio" pendingLabel="Generando…">
      {() => <input type="hidden" name="prospectId" value={prospectId} />}
    </ActionForm>
  );
}

export function SiteCopyForm({ prospectId, maxCostUsd }: { prospectId: string; maxCostUsd: number }) {
  return (
    <ActionForm
      action={requestSiteCopyAction}
      submitLabel="Pulir textos con IA"
      submitClass="btn"
      pendingLabel="Redactando… puede tardar un minuto"
      confirm={() => ({
        title: "Pulir textos con IA",
        body: `Claude reescribe los textos de la última ficha para que suenen profesionales, sin agregar datos. Si agrega cifras, cambia los servicios o usa frases de plantilla, se descarta. Costo máximo aproximado: US$ ${maxCostUsd.toFixed(2)}. El resultado queda como una ficha nueva que podés revisar.`,
        confirmLabel: "Pulir textos",
      })}
    >
      {() => <input type="hidden" name="prospectId" value={prospectId} />}
    </ActionForm>
  );
}
