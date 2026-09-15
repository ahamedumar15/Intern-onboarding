/**
 * Seeds the PMO board from `prisma/seed/tickets.json` (FR-1, S-003).
 *
 * Upserts on `reference`, so running it twice leaves the row count unchanged
 * (AC-1.5). The file is validated before anything is written — a malformed seed
 * should fail loudly here, not produce a half-populated board.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { OWNER_MAX_LENGTH, PrioritySchema, StatusSchema } from "../src/lib/contracts";

const SeedTicketSchema = z
  .object({
    reference: z.string().min(1),
    title: z.string().min(1).max(160),
    description: z.string().min(1),
    squad: z.string().min(1),
    status: StatusSchema,
    priority: PrioritySchema.nullable(),
    owner: z.string().min(1).max(OWNER_MAX_LENGTH).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

const SeedFileSchema = z.array(SeedTicketSchema).min(1);

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const seedPath = fileURLToPath(new URL("./seed/tickets.json", import.meta.url));
  const parsed = SeedFileSchema.safeParse(
    JSON.parse(await readFile(seedPath, "utf8")) as unknown,
  );

  if (!parsed.success) {
    console.error("Seed file failed validation:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const seeds = parsed.data;

  const duplicates = seeds
    .map((seed) => seed.reference)
    .filter((reference, index, all) => all.indexOf(reference) !== index);
  if (duplicates.length > 0) {
    console.error(`Duplicate references in seed file: ${duplicates.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  for (const seed of seeds) {
    const data = {
      title: seed.title,
      description: seed.description,
      squad: seed.squad,
      status: seed.status,
      priority: seed.priority,
      owner: seed.owner,
      createdAt: new Date(seed.createdAt),
    };

    await prisma.ticket.upsert({
      where: { reference: seed.reference },
      create: { reference: seed.reference, ...data },
      update: data,
    });
  }

  const total = await prisma.ticket.count();
  const open = await prisma.ticket.count({ where: { status: "OPEN" } });
  const untriaged = await prisma.ticket.count({
    where: { status: "OPEN", priority: null },
  });
  const unowned = await prisma.ticket.count({
    where: { status: "OPEN", owner: null },
  });

  console.log(
    `Seeded ${seeds.length} tickets. Rows in database: ${total} ` +
      `(open ${open}, of which untriaged ${untriaged} and unowned ${unowned}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
