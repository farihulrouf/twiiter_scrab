import { Controller, Get, Query, Body, Post, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PostService } from './post.service';
import { Post as PostEntity } from './post.entity';

@ApiTags('posts') // Menambahkan tag Swagger
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiResponse({ status: 200, description: 'Return list of posts.' })
  async getPosts(
    @Query('page') page: number = 1, // Default halaman 1
    @Query('limit') limit: number = 10, // Default limit 10
  ) {
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (isNaN(pageNum) || isNaN(limitNum)) {
      throw new BadRequestException('Page and limit should be valid numbers.');
    }

    if (pageNum <= 0 || limitNum <= 0) {
      throw new BadRequestException('Page and limit should be greater than 0.');
    }

    return this.postService.getPostsWithPagination(pageNum, limitNum);
  }

  @Post()
  @ApiExcludeEndpoint() // Menyembunyikan endpoint dari Swagger
  async create(@Body() postData: PostEntity): Promise<PostEntity> {
    return this.postService.createPost(postData);
  }
}
