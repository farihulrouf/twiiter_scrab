import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ScrapeService } from './scrape.service';

@ApiTags('scrape') // Menambahkan tag Swagger
@Controller('scrape')
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Get()
  @ApiExcludeEndpoint() // Menyembunyikan endpoint dari Swagger
  async scrape() {
    try {
      await this.scrapeService.scrapeAndSend();
      return { message: 'Scraping completed successfully.' };
    } catch (error) {
      return { error: 'Failed to scrape and process data.' };
    }
  }
}
