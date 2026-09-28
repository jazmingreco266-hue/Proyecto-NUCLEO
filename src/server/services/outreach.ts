import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { outreachMessages, prospectFacts, prospects } from "@/db/schema";
import {
  emailHtmlFromText,
  generateOutreach,
  outreachInputSchema,
  suggestBestTime,
  suggestChannel,
  type OutreachDraft,
} from "@/domain/outreach";
import { audit } from "../audit";
import { actorOf, assertCan, NotFoundError, UserFacingError, type Principal } from "../principal";
import { getSettings } from "./settings";

export type OutreachRow = typeof outreachMessages.$inferSelect;

async function loadContext(db: Db, who: Principal, prospectId: string) {
  if (!z.string().uuid().safeParse(prospectId).success) throw new NotFoundError("El prospecto");
  const [p] = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.id, prospectId), isNull(prospects.deletedAt)))
    .limit(1);
  if (!p) throw new NotFoundError("El prospecto");
  const contacts = await db
    .select({ field: prospectFacts.field, value: prospectFacts.value, verification: prospectFacts.verification })
    .from(prospectFacts)
    .where(
      and(eq(prospectFacts.prospectId, prospectId), eq(prospectFacts.category, "contact"), isNull(prospectFacts.deletedAt)),
    );
  const { data: settings } = await getSettings(db, who);
  return { p, contacts, sender: settings.sender };
}

async function insertVersion(
  db: Db,
  who: Principal,
  prospectId: string,
  draft: OutreachDraft,
  inputs: Record<string, unknown>,
  action: string,
) {
  const actor = actorOf(who);
  return db.transaction(async (tx) => {
    // Serializa las versiones de un mismo prospecto.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(727003, hashtext(${prospectId}))`);
    const [last] = await tx
      .select({ v: outreachMessages.version })
      .from(outreachMessages)
      .where(eq(outreachMessages.prospectId, prospectId))
      .orderBy(desc(outreachMessages.version))
      .limit(1);
    const version = (last?.v ?? 0) + 1;
    const [row] = await tx
      .insert(outreachMessages)
      .values({
        prospectId,
        version,
        subjects: draft.subjects,
        emailText: draft.emailText,
        emailHtml: draft.emailHtml,
        whatsappText: draft.whatsappText,
        formText: draft.formText,
        socialText: draft.socialText,
        suggestedChannel: draft.suggestedChannel,
        channelReason: draft.channelReason,
        bestTime: draft.bestTime,
        inputs,
        createdByType: actor.type,
        createdById: actor.id,
      })
      .returning();
    await audit(tx, who, { action, entityType: "prospect", entityId: prospectId, metadata: { version } });
    return row!;
  });
}

/** Genera una versión nueva de los mensajes a partir de la investigación. */
export async function generateMessages(db: Db, who: Principal, prospectId: string, rawInput: unknown) {
  assertCan(who, "prospects.write");
  const parsed = outreachInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues.map((i) => i.message).join(" · "));
  const { p, contacts, sender } = await loadContext(db, who, prospectId);
  const r = generateOutreach(
    { name: p.name, city: p.city, industry: p.industry, country: p.country },
    sender,
    parsed.data,
    contacts,
  );
  if (!r.ok) throw new UserFacingError(`Falta completar: ${r.missing.join(" · ")}.`);
  return insertVersion(db, who, prospectId, r.draft, { ...parsed.data, origen: "generado" }, "outreach.generate");
}

const editSchema = z.object({
  subject1: z.string().trim().min(3).max(150),
  subject2: z.string().trim().min(3).max(150),
  subject3: z.string().trim().min(3).max(150),
  emailText: z.string().trim().min(20, "El email está vacío").max(8000),
  whatsappText: z.string().trim().min(10).max(2000),
  formText: z.string().trim().min(10).max(4000),
  socialText: z.string().trim().min(10).max(2000),
  basedOnVersion: z.coerce.number().int().positive(),
});

/** Guarda una edición a mano como versión nueva. La anterior queda intacta. */
export async function saveEditedMessages(db: Db, who: Principal, prospectId: string, rawInput: unknown) {
  assertCan(who, "prospects.write");
  const parsed = editSchema.safeParse(rawInput);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues.map((i) => i.message).join(" · "));
  const e = parsed.data;
  const { p, contacts, sender } = await loadContext(db, who, prospectId);
  const [base] = await db
    .select()
    .from(outreachMessages)
    .where(and(eq(outreachMessages.prospectId, prospectId), eq(outreachMessages.version, e.basedOnVersion)))
    .limit(1);
  if (!base) throw new NotFoundError("La versión de los mensajes");
  const demoUrl = typeof (base.inputs as { demoUrl?: unknown }).demoUrl === "string" ? ((base.inputs as { demoUrl: string }).demoUrl) : "";
  const subjects = [e.subject1, e.subject2, e.subject3];
  const { channel, reason } = suggestChannel(contacts);
  const draft: OutreachDraft = {
    subjects,
    emailText: e.emailText,
    emailHtml: emailHtmlFromText(subjects[0]!, e.emailText, sender, demoUrl),
    whatsappText: e.whatsappText,
    formText: e.formText,
    socialText: e.socialText,
    suggestedChannel: channel,
    channelReason: reason,
    bestTime: suggestBestTime({ name: p.name, city: p.city, industry: p.industry, country: p.country }),
  };
  return insertVersion(
    db,
    who,
    prospectId,
    draft,
    { ...(base.inputs as object), origen: "editado", basadoEnVersion: e.basedOnVersion },
    "outreach.edit",
  );
}

export async function listMessages(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  return db
    .select()
    .from(outreachMessages)
    .where(eq(outreachMessages.prospectId, prospectId))
    .orderBy(desc(outreachMessages.version));
}

export async function getMessage(db: Db, who: Principal, id: string) {
  assertCan(who, "prospects.read");
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("El mensaje");
  const [row] = await db.select().from(outreachMessages).where(eq(outreachMessages.id, id)).limit(1);
  if (!row) throw new NotFoundError("El mensaje");
  return row;
}
