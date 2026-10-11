import { PrismaClient } from "@prisma/client";
import { EXERCISES, FOODS } from "../src/data.js";
const prisma = new PrismaClient();

async function main() {
  for (const e of EXERCISES) await prisma.exercise.upsert({ where: { name: e.name }, update: e, create: e });
  for (const [name, aliases, kcal, protein, carbs, fat, fiber, units, diet, density] of FOODS) {
    const data = { name, aliases, kcal, protein, carbs, fat, fiber, units, diet, density: density ?? null, source: "Seed estimate (approximate per-100 g values; verify against labels)", profileId: null };
    const existing = await prisma.food.findFirst({ where: { name, profileId: null } });
    if (existing) await prisma.food.update({ where: { id: existing.id }, data });
    else await prisma.food.create({ data });
  }
  console.log(`Seeded ${EXERCISES.length} exercises and ${FOODS.length} foods`);
}
main().finally(() => prisma.$disconnect());
