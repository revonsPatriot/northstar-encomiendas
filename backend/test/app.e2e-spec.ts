import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';

process.env.JWT_SECRET = 'e2e-test-secret-with-enough-length';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

describe('API (e2e, sin base de datos)', () => {
  let app: INestApplication<App>;
  let token: string;

  const prismaMock = {
    shipment: { findUnique: jest.fn().mockResolvedValue(null) },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    // require (no import estático) para fijar las variables de entorno antes de cargar los módulos.
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
    const { AppModule } = require('../src/app.module');
    const { PrismaService } = require('../src/modules/shipments/infrastructure/persistence/prisma.service');
    const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    token = await app.get(JwtService).signAsync({
      userId: 'u1',
      branchId: '11111111-1111-4111-8111-111111111111',
      ci: '1',
      fullName: 'Operador',
      role: 'OPERADOR',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza rutas privadas sin token', async () => {
    await request(app.getHttpServer()).get('/api/cash/dashboard').expect(401);
    await request(app.getHttpServer()).post('/api/shipments').send({}).expect(401);
  });

  it('valida el cuerpo al registrar un envío', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ originBranchId: 'no-uuid', items: [] })
      .expect(400);
    expect(typeof response.body.message).toBe('string');
  });

  it('el rastreo público devuelve 404 si la guía no existe', async () => {
    await request(app.getHttpServer()).get('/api/public/track/000001').expect(404);
  });

  it('el rastreo público rechaza guías con formato inválido', async () => {
    await request(app.getHttpServer()).get('/api/public/track/abc').expect(400);
  });

  it('un operador no puede acceder a la administración', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('un operador no puede anular guías', async () => {
    await request(app.getHttpServer())
      .patch('/api/shipments/004154/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Motivo de prueba' })
      .expect(403);
  });

  it('un operador no puede consultar otra sucursal', async () => {
    await request(app.getHttpServer())
      .get('/api/shipments/branch/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
