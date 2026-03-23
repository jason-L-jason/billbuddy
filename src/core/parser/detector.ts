import { Platform } from '@/types';

export type DetectedFileType =
  | { type: 'wechat_csv'; platform: Platform }
  | { type: 'wechat_xlsx'; platform: Platform }
  | { type: 'alipay_csv'; platform: Platform }
  | { type: 'taobao_excel'; platform: 'taobao' }
  | { type: 'jd_excel'; platform: 'jd' }
  | { type: 'unknown' };

/**
 * 检测 CSV 内容属于哪个平台
 */
export function detectCSVPlatform(content: string): DetectedFileType {
  // 微信账单特征：包含"微信支付账单明细" 或特定表头
  if (
    content.includes('微信支付账单') ||
    (content.includes('交易对方') && content.includes('商户单号') && content.includes('当前状态'))
  ) {
    return { type: 'wechat_csv', platform: 'wechat' };
  }

  // 支付宝账单特征：包含"支付宝交易记录" 或特定表头
  if (
    content.includes('支付宝') ||
    content.includes('交易号') ||
    (content.includes('交易对方') && content.includes('商家订单号') && content.includes('交易分类'))
  ) {
    return { type: 'alipay_csv', platform: 'alipay' };
  }

  return { type: 'unknown' };
}

/**
 * 根据文件名猜测类型
 */
export function detectByFileName(fileName: string): DetectedFileType {
  const lower = fileName.toLowerCase();
  const ext = lower.split('.').pop();

  if (lower.includes('微信') || lower.includes('wechat')) {
    // 微信 xlsx 还是 csv
    if (ext === 'xlsx' || ext === 'xls') {
      return { type: 'wechat_xlsx', platform: 'wechat' };
    }
    return { type: 'wechat_csv', platform: 'wechat' };
  }
  if (lower.includes('支付宝') || lower.includes('alipay')) {
    return { type: 'alipay_csv', platform: 'alipay' };
  }
  if (lower.includes('淘宝') || lower.includes('taobao')) {
    return { type: 'taobao_excel', platform: 'taobao' };
  }
  if (lower.includes('京东') || lower.includes('jd') || lower.includes('jingdong')) {
    return { type: 'jd_excel', platform: 'jd' };
  }

  return { type: 'unknown' };
}

/**
 * 读取文件内容（自动处理编码）
 * 支付宝是 GBK 编码，微信是 UTF-8
 */
export async function readFileContent(file: File): Promise<string> {
  // 先尝试 UTF-8
  const utf8Content = await readAsText(file, 'utf-8');

  // 如果含有乱码特征（很多 ???），尝试 GBK
  if (hasGarbledText(utf8Content)) {
    const gbkContent = await readAsText(file, 'gbk');
    return gbkContent;
  }

  return utf8Content;
}

function readAsText(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, encoding);
  });
}

function hasGarbledText(content: string): boolean {
  // 简单的乱码检测：连续出现多个 replacement character
  const replacementCount = (content.match(/\uFFFD/g) || []).length;
  return replacementCount > 5;
}
