/**
 * Wyrt Data Module - Base Seeder
 *
 * This is the game-agnostic seed script for wyrt_data.
 * Game-specific content should live in each game module's scripts/seed.ts.
 *
 * To seed a specific game:
 *   npx tsx modules/<game>/scripts/seed.ts
 *
 * For MyGame:
 *   npx tsx modules/my_game/scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('============================================================');
  console.log('Wyrt Data Module - Base Seeder');
  console.log('============================================================\n');

  console.log('This is the base wyrt_data seeder.');
  console.log('Game-specific content should be seeded from game modules.\n');

  // List any existing games
  const games = await prisma.game.findMany({
    select: { slug: true, name: true, version: true, type: true }
  });

  if (games.length > 0) {
    console.log('Existing games in database:');
    for (const game of games) {
      console.log(`  - ${game.name} (${game.slug}) v${game.version} [${game.type}]`);
    }
  } else {
    console.log('No games found in database.');
    console.log('\nTo seed a game, run its module seeder:');
    console.log('  npx tsx modules/my_game/scripts/seed.ts');
  }

  console.log('\n============================================================');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
