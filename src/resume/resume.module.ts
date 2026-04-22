import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Resume } from './entities/resume.entity';
import { ResumeService } from './resume.service';
import { ResumeController } from './resume.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AiModule,
    TypeOrmModule.forFeature([Resume]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
        ];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  ],
  controllers: [ResumeController],
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}
