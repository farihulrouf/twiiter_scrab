import { Controller, Get, Query, Body, Post } from '@nestjs/common';
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

    if (isNaN(pageNum) || isNaN(limitNum)) {
      throw new Error('Page and limit should be valid numbers.');
    }

    return this.postService.getPostsWithPagination(pageNum, limitNum);
  }

  @Post()
  async create(@Body() postData: PostEntity): Promise<PostEntity> {
    return this.postService.createPost(postData);
  }
}
