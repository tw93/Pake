import { PakeAppOptions } from '@/types.js';

/**
 * Builder接口
 * 不同平台打包过程需要实现 prepare 和 build 方法
 */
export interface IBuilder {
  /** 前置检查 */
  prepare(): Promise<void>;
  /**
   * 开始打包
   * @param url 打包url
   * @param options 配置参数
   */
  build(url: string, options: PakeAppOptions): Promise<void>;
}
