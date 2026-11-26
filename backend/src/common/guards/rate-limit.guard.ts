import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter en memoria (por IP + ruta). Suficiente para una sola instancia;
 * si se escala horizontalmente conviene moverlo a Redis.
 */
export function createRateLimitGuard(limit: number, windowMs: number) {
  @Injectable()
  class RateLimitGuard implements CanActivate {
    readonly buckets = new Map<string, Bucket>();

    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<Request>();
      const now = Date.now();
      const key = `${request.ip}:${request.method}:${request.route?.path ?? request.path}`;
      const bucket = this.buckets.get(key);

      if (this.buckets.size > 5000) {
        for (const [bucketKey, value] of this.buckets) {
          if (value.resetAt <= now) this.buckets.delete(bucketKey);
        }
      }

      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      bucket.count += 1;
      if (bucket.count > limit) {
        throw new HttpException(
          'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    }
  }
  return RateLimitGuard;
}

export const LoginRateLimitGuard = createRateLimitGuard(10, 15 * 60 * 1000);
export const TrackRateLimitGuard = createRateLimitGuard(60, 60 * 1000);
