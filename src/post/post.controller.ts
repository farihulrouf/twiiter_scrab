import { Controller, Get, Query, Body, Post, BadRequestException } from '@nestjs/common';
import { PostService } from './post.service';
import { Post as PostEntity } from './post.entity';  // Ganti nama kelas untuk menghindari konflik nama

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  async getPosts(
    @Query('page') page: number = 1, // Default halaman 1
    @Query('limit') limit: number = 10, // Default limit 10
  ) {
    // Pastikan bahwa page dan limit berupa angka
    const pageNum = Number(page);
    const limitNum = Number(limit);

    // Validasi untuk memastikan page dan limit adalah angka
    if (isNaN(pageNum) || isNaN(limitNum)) {
      throw new BadRequestException('Page and limit should be valid numbers.');
    }

    // Validasi jika page atau limit kurang dari atau sama dengan 0
    if (pageNum <= 0 || limitNum <= 0) {
      throw new BadRequestException('Page and limit should be greater than 0.');
    }

    return this.postService.getPostsWithPagination(pageNum, limitNum);
  }

  @Post()
  async create(@Body() postData: PostEntity): Promise<PostEntity> {
    return this.postService.createPost(postData);
  }
}
