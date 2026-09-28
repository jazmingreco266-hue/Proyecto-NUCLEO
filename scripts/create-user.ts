/**
 * Crea un usuario desde la consola. Es la única forma de crear el primer propietario:
 * no hay credenciales por defecto en el código.
 *
 *   npm run user:create -- --email vos@empresa.com --name "Tu nombre" --role owner
 *
 * La contraseña se pide por la entrada estándar (no queda en el historial de la terminal).
 */
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { closeDb, getDb } from "../src/db/client";
import { createUser } from "../src/server/services/users";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "owner" },
  },
});

async function readPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  if (process.stdin.isTTY) {
    // Oculta lo que se escribe.
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    const original = out._writeToOutput.bind(rl);
    let prompted = false;
    out._writeToOutput = (s: string) => {
      if (!prompted) {
        original(s);
        prompted = true;
      } else out.output.write("*");
    };
  }
  const pw = await rl.question("Contraseña (mínimo 12 caracteres, letras y números): ");
  rl.close();
  if (process.stdin.isTTY) process.stdout.write("\n");
  return pw;
}

try {
  if (!values.email || !values.name) {
    throw new Error('Uso: npm run user:create -- --email vos@empresa.com --name "Tu nombre" [--role owner|operator|viewer]');
  }
  const password = await readPassword();
  const user = await createUser(getDb(), "bootstrap", {
    email: values.email,
    name: values.name,
    role: values.role,
    password,
  });
  console.log(`✔ Usuario creado: ${user.name} <${user.email}> con rol ${user.role}.`);
} catch (err) {
  console.error(`✖ ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
