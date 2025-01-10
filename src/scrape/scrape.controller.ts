import { Controller, Post, Body } from '@nestjs/common';
import { ScrapeService } from './scrape.service';
import { ApiBody, ApiResponse } from '@nestjs/swagger'; // Import decorators from @nestjs/swagger

@Controller('scrape')
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Post()
  @ApiBody({ type: Object }) // Specify the type of the body (in this case, a generic Object)
  @ApiResponse({ status: 200, description: 'Scraping completed successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to scrape and process data.' })
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
