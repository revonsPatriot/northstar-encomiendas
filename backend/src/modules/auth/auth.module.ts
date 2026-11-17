import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ShipmentsModule } from '../shipments/shipments.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured.');
}

@Global()
@Module({
  imports: [
    ShipmentsModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}