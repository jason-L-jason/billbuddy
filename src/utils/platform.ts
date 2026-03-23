import type { Platform, EcommercePlatform } from '@/types';

const PLATFORM_LABELS: Record<Platform | EcommercePlatform, string> = {
  wechat: '微信',
  alipay: '支付宝',
  taobao: '淘宝',
  jd: '京东',
  pdd: '拼多多',
};

/** 将平台 key 转为中文显示名 */
export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] || platform;
}

const PLATFORM_STYLES: Record<string, string> = {
  wechat: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  alipay: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  taobao: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  jd: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/** 获取平台标签的 Tailwind 样式类 */
export function getPlatformStyle(platform: string): string {
  return PLATFORM_STYLES[platform] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}
