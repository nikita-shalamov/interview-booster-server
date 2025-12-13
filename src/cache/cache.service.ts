// cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AppCacheService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async wrap<T>(key: string, ttl: number, fn: () => Promise<T>) {
    const cached = await this.cache.get<T>(key);
    if (cached) return cached;

    const result = await fn();
    await this.cache.set(key, result, ttl);
    return result;
  }
}
