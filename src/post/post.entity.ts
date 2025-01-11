import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  @ApiProperty({
    description: 'Unique identifier of the post',
    example: 1,
  })
  id: number;

  @Column('text', { nullable: true })
  @ApiProperty({
    description: 'Content of the post',
    example: 'This is an example post.',
    nullable: true,
  })
  text: string;

  @Column('text', { nullable: true })
  @ApiProperty({
    description: 'Comma-separated list of image URLs associated with the post',
    example: 'image1.jpg,image2.jpg',
    nullable: true,
  })
  images: string;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({
    description: 'Timestamp of when the post was created',
    example: '2025-01-11T12:00:00Z',
  })
  date: Date;

  @Column('varchar', { length: 255, nullable: true })
  @ApiProperty({
    description: 'Username of the post creator',
    example: 'john_doe',
    nullable: true,
  })
  username: string;

  @Column('text', { nullable: true })
  @ApiProperty({
    description: 'Link to the original tweet',
    example: 'https://twitter.com/user/status/123456789',
    nullable: true,
  })
  link_tweet: string;
}
