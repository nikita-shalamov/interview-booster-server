import { DataSource } from 'typeorm';
import { seedInterviewTemplates } from './seed-templates';

async function runSeed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'interview_booster',
    entities: ['src/**/*.entity{.js,.ts}'],
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    await seedInterviewTemplates(dataSource);

    console.log('✅ Seed completed successfully');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runSeed();
