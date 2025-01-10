import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async getPostsWithPagination(page: number, limit: number) {
    try {
      const skip = (page - 1) * limit; // Hitung offset untuk pagination
      const [posts, total] = await this.postRepository.findAndCount({
        skip,
        take: limit,
      });

      return {
        total,
        page,
        limit,
        data: posts,
      };
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw new Error('Error fetching posts');
    }
  }
}
