import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LoginRateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './infrastructure/guards/jwt-auth.guard';

class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  ci!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password!: string;
}

class RegisterDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @Matches(/^[0-9A-Za-z-]{5,20}$/)
  ci!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accessCode?: string;
}

class ChangePasswordDto {
  @IsString()
  @MaxLength(100)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.ci, dto.password);
  }

  @Post('register')
  @UseGuards(LoginRateLimitGuard)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user.userId);
  }

  @Get('me/activity')
  @UseGuards(JwtAuthGuard)
  activity(@Req() request: AuthenticatedRequest) {
    return this.authService.activity(request.user.userId);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.changePassword(
      request.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
