import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(',').map((value) => value.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ZhongSai CRM API')
    .setDescription('中赛钢构海外广告线索 CRM 后端接口')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  // 提供前端静态文件
  const webDistPath = join(__dirname, '../../apps/web/dist');
  app.use(express.static(webDistPath));
  // 非API路径返回index.html（支持React Router前端路由）
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/*', (req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(webDistPath, 'index.html'));
  });

  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

void bootstrap();

