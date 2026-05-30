import { PrismaClient } from "@prisma/client";
import { upsertDefaultForumSections } from "./default-sections";

const prisma = new PrismaClient();

async function main() {
  const sections = await upsertDefaultForumSections(prisma);
  console.log(`Default forum sections ready: ${sections.map((section) => section.name).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
