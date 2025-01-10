import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';  // Import Swagger components

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Post API')  // Set title of your API
    .setDescription('The Post API description')  // Provide a description
    .setVersion('1.0')  // Set version
    .addTag('posts')  // Add a tag to group API methods (optional)
    .build();

  // Create Swagger document
  const document = SwaggerModule.createDocument(app, config);
  
  // Set up Swagger UI at /api endpoint
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);  // Aplikasi berjalan di port 3000
}
bootstrap();
