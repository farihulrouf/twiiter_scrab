import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post } from './post.entity';  // Pastikan impor entitas Post di sini

@Module({
  imports: [TypeOrmModule.forFeature([Post])],  // Daftarkan entitas Post di sini
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
