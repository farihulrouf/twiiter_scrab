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

  // Method untuk membuat post baru
  async createPost(postData: Post): Promise<Post> {
    const post = this.postRepository.create(postData); // Membuat instance baru Post
    return this.postRepository.save(post); // Menyimpan post ke database
  }

  // Method untuk mengambil data post dengan pagination
  async getPostsWithPagination(page: number, limit: number) {
    try {
      const skip = (page - 1) * limit; // Hitung offset untuk pagination
      console.log('Fetching posts:', { skip, limit });  // Debugging: cek skip dan limit

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
