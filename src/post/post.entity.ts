import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { nullable: true })
  text: string;

  @Column('text', { nullable: true })
  images: string;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column('varchar', { length: 255, nullable: true })
  username: string;

}

