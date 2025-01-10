import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { Post } from '../post/post.entity'

dotenv.config(); // Memuat file .env

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [Post], // Menyertakan entitas Post secara eksplisit
  synchronize: true, // Hati-hati menggunakan ini di production
};
