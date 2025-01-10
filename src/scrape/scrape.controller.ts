import { Controller, Post, Body } from '@nestjs/common';
import { ScrapeService } from './scrape.service';

@Controller('scrape') // Prefix rute dengan '/scrape'
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Post() // Menangani permintaan POST ke /scrape
  async scrape(@Body() body: { username: string }) {
    const { username } = body;
    if (!username) {
      return { error: 'Username is required.' };
    }
    try {
      await this.scrapeService.scrapeAndSend(username);
      return { message: 'Scraping completed successfully.' };
    } catch (error) {
      return { error: 'Failed to scrape and process data.' };
    }
  }
}
