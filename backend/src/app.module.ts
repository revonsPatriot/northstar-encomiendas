import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShipmentsModule } from './modules/shipments/shipments.module';

@Module({
  imports: [ShipmentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
