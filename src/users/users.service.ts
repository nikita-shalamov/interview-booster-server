import { Injectable, Inject } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { hash } from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @Inject(CACHE_MANAGER)
    private cache: Cache,
  ) {}

  async create(dto: CreateUserDto) {
    const user = {
      ...dto,
      password: dto.password ? await hash(dto.password) : undefined,
    };
    return await this.userRepository.save(user);
  }

  async findByGoogleId(googleId: string) {
    return await this.userRepository.findOneBy({ googleId });
  }

  findAll() {
    return this.userRepository.find();
  }

  async findOne(id: number) {
    const key = `user:${id}`;

    const cached = await this.cache.get<User>(key);
    if (cached) return cached;

    const user = await this.userRepository.findOneBy({ id });

    if (user) await this.cache.set(key, user, 10000);

    return user;
  }

  async findByEmail(email: string) {
    return await this.userRepository.findOneBy({ email });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.userRepository.update(id, dto);

    await this.cache.del(`user:${id}`);

    const updatedUser = await this.userRepository.findOneBy({ id });
    if (updatedUser) {
      await this.cache.set(`user:${id}`, updatedUser, 10000);
    }

    return updatedUser;
  }

  async remove(id: number) {
    await this.userRepository.delete(id);

    await this.cache.del(`user:${id}`);

    return `User ${id} deleted`;
  }
}
