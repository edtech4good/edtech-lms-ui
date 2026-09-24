/**
 * Credential guard for non-local URLs: automation accounts were rotated on
 * 18 Sep 2026, and the `demo` fallback only works against a fresh local seed.
 * Prove that the guard correctly identifies missing env vars.
 */
import { test, expect } from '@playwright/test';
import { missingCredentialVars } from './credentials';

test.describe('missingCredentialVars', () => {
  test('localhost:8081 with no vars returns empty', () => {
    const result = missingCredentialVars('http://localhost:8081', {});
    expect(result).toEqual([]);
  });

  test('127.0.0.1 with no vars returns empty', () => {
    const result = missingCredentialVars('http://127.0.0.1:8095', {});
    expect(result).toEqual([]);
  });

  test('::1 with no vars returns empty', () => {
    const result = missingCredentialVars('http://[::1]:8095', {});
    expect(result).toEqual([]);
  });

  test('0.0.0.0 with no vars returns empty', () => {
    const result = missingCredentialVars('http://0.0.0.0:8095', {});
    expect(result).toEqual([]);
  });

  test('*.localhost with no vars returns empty', () => {
    const result = missingCredentialVars('http://app.localhost:8095', {});
    expect(result).toEqual([]);
  });

  test('non-local URL with no vars returns both missing', () => {
    const result = missingCredentialVars('https://app.uat.mekonginclusive.com', {});
    expect(result).toHaveLength(2);
    expect(result).toContain('E2E_EXPO_CORPORATE_PASS (or E2E_EXPO_STUDENT_PASS)');
    expect(result).toContain('E2E_EXPO_KIDS_PASS (or E2E_EXPO_STUDENT_PASS)');
  });

  test('non-local URL with only E2E_EXPO_STUDENT_PASS returns empty', () => {
    const result = missingCredentialVars('https://app.uat.mekonginclusive.com', {
      E2E_EXPO_STUDENT_PASS: 'password123',
    });
    expect(result).toEqual([]);
  });

  test('non-local URL with only E2E_EXPO_CORPORATE_PASS returns kids missing', () => {
    const result = missingCredentialVars('https://app.uat.mekonginclusive.com', {
      E2E_EXPO_CORPORATE_PASS: 'password123',
    });
    expect(result).toHaveLength(1);
    expect(result).toContain('E2E_EXPO_KIDS_PASS (or E2E_EXPO_STUDENT_PASS)');
  });

  test('non-local URL with only E2E_EXPO_KIDS_PASS returns corporate missing', () => {
    const result = missingCredentialVars('https://app.uat.mekonginclusive.com', {
      E2E_EXPO_KIDS_PASS: 'password123',
    });
    expect(result).toHaveLength(1);
    expect(result).toContain('E2E_EXPO_CORPORATE_PASS (or E2E_EXPO_STUDENT_PASS)');
  });

  test('empty string counts as missing', () => {
    const result = missingCredentialVars('https://app.uat.mekonginclusive.com', {
      E2E_EXPO_CORPORATE_PASS: '',
      E2E_EXPO_KIDS_PASS: '',
    });
    expect(result).toHaveLength(2);
    expect(result).toContain('E2E_EXPO_CORPORATE_PASS (or E2E_EXPO_STUDENT_PASS)');
    expect(result).toContain('E2E_EXPO_KIDS_PASS (or E2E_EXPO_STUDENT_PASS)');
  });

  test('unparseable URL treated as non-local', () => {
    const result = missingCredentialVars('not a valid url', {});
    expect(result).toHaveLength(2);
    expect(result).toContain('E2E_EXPO_CORPORATE_PASS (or E2E_EXPO_STUDENT_PASS)');
    expect(result).toContain('E2E_EXPO_KIDS_PASS (or E2E_EXPO_STUDENT_PASS)');
  });
});
