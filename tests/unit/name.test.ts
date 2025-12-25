import { describe, it, expect } from 'vitest';
import {
  getSafeAppName,
  generateLinuxPackageName,
  generateIdentifierSafeName,
} from '@/utils/name';

describe('getSafeAppName', () => {
  it('should handle simple names', () => {
    expect(getSafeAppName('MyApp')).toBe('myapp');
  });

  it('should handle names with spaces', () => {
    expect(getSafeAppName('My App')).toBe('my_app');
  });

  it('should handle names with hyphens', () => {
    expect(getSafeAppName('my-app')).toBe('my-app');
  });

  it('should handle Chinese names', () => {
    expect(getSafeAppName('我的应用')).toBe('我的应用');
  });

  it('should handle mixed Chinese and English', () => {
    expect(getSafeAppName('我的 App')).toBe('我的_app');
  });

  it('should preserve special characters like @', () => {
    expect(getSafeAppName('App@2024')).toBe('app@2024');
  });

  it('should replace forward slashes', () => {
    expect(getSafeAppName('My/App')).toBe('my_app');
  });

  it('should replace backslashes', () => {
    expect(getSafeAppName('My\\App')).toBe('my_app');
  });

  it('should replace colons', () => {
    expect(getSafeAppName('App:Name')).toBe('app_name');
  });

  it('should replace asterisks', () => {
    expect(getSafeAppName('App*Name')).toBe('app_name');
  });

  it('should replace question marks', () => {
    expect(getSafeAppName('App?Name')).toBe('app_name');
  });

  it('should replace double quotes', () => {
    expect(getSafeAppName('App"Name')).toBe('app_name');
  });

  it('should replace angle brackets', () => {
    expect(getSafeAppName('App<Name>')).toBe('app_name_');
  });

  it('should replace pipes', () => {
    expect(getSafeAppName('App|Name')).toBe('app_name');
  });

  it('should handle all uppercase names', () => {
    expect(getSafeAppName('APP')).toBe('app');
  });

  it('should handle single character names', () => {
    expect(getSafeAppName('a')).toBe('a');
  });

  it('should handle numeric names', () => {
    expect(getSafeAppName('123')).toBe('123');
  });

  it('should handle leading/trailing spaces', () => {
    expect(getSafeAppName('  App  ')).toBe('_app_');
  });

  it('should handle trailing dots', () => {
    expect(getSafeAppName('App...')).toBe('app');
  });

  it('should truncate very long names', () => {
    const longName = 'A'.repeat(300);
    const expected = 'a'.repeat(255);
    expect(getSafeAppName(longName)).toBe(expected);
  });
});

describe('generateLinuxPackageName', () => {
  it('should handle simple names', () => {
    expect(generateLinuxPackageName('MyApp')).toBe('myapp');
  });

  it('should replace spaces and special characters with hyphens', () => {
    expect(generateLinuxPackageName('My App! @123')).toBe('my-app-123');
  });

  it('should handle multiple hyphens', () => {
    expect(generateLinuxPackageName('my--app')).toBe('my-app');
  });

  it('should handle Chinese characters', () => {
    expect(generateLinuxPackageName('我的应用')).toBe('我的应用');
  });

  it('should trim leading/trailing hyphens', () => {
    expect(generateLinuxPackageName('--my-app--')).toBe('my-app');
  });
});

describe('generateIdentifierSafeName', () => {
  it('should handle alphanumeric names', () => {
    expect(generateIdentifierSafeName('MyApp123')).toBe('myapp123');
  });

  it('should remove special characters', () => {
    expect(generateIdentifierSafeName('My-App! @#')).toBe('myapp');
  });

  it('should handle Chinese characters', () => {
    expect(generateIdentifierSafeName('我的应用App')).toBe('我的应用app');
  });

  it('should provide fallback for names without alphanumeric/Chinese', () => {
    expect(generateIdentifierSafeName('!@#$')).not.toBe('');
    expect(generateIdentifierSafeName('!@#$')).not.toBe('!@#$');
  });
});
