import { Module } from '@nestjs/common';
import { ScrapeService } from './scrape.service';
import { ScrapeController } from './scrape.controller';

@Module({
  providers: [ScrapeService],
  controllers: [ScrapeController],
})
export class ScrapeModule {}
