import { Module } from '@nestjs/common';
import { ScrapeModule } from './scrape/scrape.module';

@Module({
  imports: [ScrapeModule],  // Memasukkan ScrapeModule ke dalam AppModule
})
export class AppModule {}
