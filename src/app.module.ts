import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapeModule } from './scrape/scrape.module';
import { PostModule } from './post/post.module';
import { typeOrmConfig } from './config/typeorm.config'; // Impor konfigurasi

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig), // Gunakan konfigurasi dari typeOrmConfig
    ScrapeModule,
    PostModule,
  ],
})
export class AppModule {}
