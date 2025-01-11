import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post } from './post.entity'; // Import entitas Post

@Module({
  imports: [TypeOrmModule.forFeature([Post])], // Mendaftarkan entitas Post
  controllers: [PostController], // Controller untuk route
  providers: [PostService], // Service untuk logika bisnis
})
export class PostModule {}





