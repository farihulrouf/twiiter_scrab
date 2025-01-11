import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapeModule } from './scrape/scrape.module';
import { PostModule } from './post/post.module';
import { typeOrmConfig } from './config/typeorm.config';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Tambahkan ini agar cron job bekerja
    TypeOrmModule.forRoot(typeOrmConfig),
    ScrapeModule,
    PostModule,
  ],
})
export class AppModule {}
