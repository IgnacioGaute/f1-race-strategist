import { DynamicModule, Module } from '@nestjs/common';
import type { F1ApiConfig } from '../config/app-config';
import { F1ApiClient, F1_API_CONFIG } from './f1-api.client';

@Module({})
export class F1ApiModule {
  static register(config: F1ApiConfig): DynamicModule {
    return {
      module: F1ApiModule,
      global: true,
      providers: [{ provide: F1_API_CONFIG, useValue: config }, F1ApiClient],
      exports: [F1ApiClient],
    };
  }
}
