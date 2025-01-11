import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) { }

  async createPost(postData: Post): Promise<Post> {
    const post = this.postRepository.create(postData); // Membuat instance baru Post
    return this.postRepository.save(post); // Menyimpan post ke database
  }

  async getPostsWithPagination(page: number, limit: number) {
    try {
      const skip = (page - 1) * limit; // Hitung offset untuk pagination
      const [posts, total] = await this.postRepository.findAndCount({
        skip,
        take: limit,
        order: {
          date: 'DESC', // Urutkan berdasarkan kolom 'date' secara descending
        },
      });
  
      // Hapus properti 'id' dari setiap post
      const sanitizedPosts = posts.map(({ id, ...rest }) => rest);
  
      return {
        total,
        page,
        limit,
        data: sanitizedPosts,
      };
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw new Error('Error fetching posts');
    }
  }
  



}
