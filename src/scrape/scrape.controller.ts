import { Controller, Post, Body } from '@nestjs/common';
import { ScrapeService } from './scrape.service';

@Controller('scrape')  // Prefix rute dengan '/scrape'
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Post()  // Menangani permintaan POST ke /scrape
  async scrape(@Body() body: { url: string }) {
    const { url } = body;
    if (!url) {
      return { error: 'URL is required.' };
    }
    try {
      await this.scrapeService.scrapeAndSend(url);
      return { message: 'Scraping completed successfully.' };
    } catch (error) {
      return { error: 'Failed to scrape and process data.' };
    }
  }
}
