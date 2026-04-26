import { DataSource } from 'typeorm';
import { InterviewTemplate } from '../entities/interview-template.entity';
import { INTERVIEW_TEMPLATES } from './interview-templates.seed';

export async function seedInterviewTemplates(dataSource: DataSource) {
  const templateRepository = dataSource.getRepository(InterviewTemplate);

  console.log('🌱 Seeding interview templates...');

  for (const templateData of INTERVIEW_TEMPLATES) {
    const existing = await templateRepository.findOne({
      where: { slug: templateData.slug },
    });

    if (existing) {
      console.log(`  ✓ Template "${templateData.name}" already exists`);
      continue;
    }

    const template = templateRepository.create(templateData);
    await templateRepository.save(template);
    console.log(`  ✓ Created template "${templateData.name}"`);
  }

  console.log(`✅ Seeded ${INTERVIEW_TEMPLATES.length} interview templates`);
}
