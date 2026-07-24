import { describe, it, expect } from 'vitest';
import { isPublicPdsEndpoint, pdsClient } from '../src/atproto/identity.js';

describe('isPublicPdsEndpoint', () => {
  it('accepts a plain HTTPS public PDS host', () => {
    expect(isPublicPdsEndpoint('https://pds.example.com')).toBe(true);
    expect(isPublicPdsEndpoint('https://morel.us-east.host.bsky.network')).toBe(true);
    // An explicit default port is stripped by the URL parser and stays valid.
    expect(isPublicPdsEndpoint('https://bsky.social:443')).toBe(true);
  });

  it('rejects non-HTTPS schemes', () => {
    expect(isPublicPdsEndpoint('http://pds.example.com')).toBe(false);
    expect(isPublicPdsEndpoint('ftp://pds.example.com')).toBe(false);
  });

  it('rejects non-standard ports', () => {
    expect(isPublicPdsEndpoint('https://pds.example.com:8080')).toBe(false);
    expect(isPublicPdsEndpoint('https://pds.example.com:1')).toBe(false);
  });

  it('rejects loopback / private / link-local IPv4 literals', () => {
    for (const ip of [
      'https://127.0.0.1',
      'https://10.0.0.5',
      'https://172.16.0.1',
      'https://192.168.1.1',
      'https://169.254.169.254', // cloud metadata
      'https://0.0.0.0',
    ]) {
      expect(isPublicPdsEndpoint(ip)).toBe(false);
    }
  });

  it('rejects IPv6 literals', () => {
    expect(isPublicPdsEndpoint('https://[::1]')).toBe(false);
    expect(isPublicPdsEndpoint('https://[fe80::1]')).toBe(false);
  });

  it('rejects internal / single-label / mDNS hosts', () => {
    expect(isPublicPdsEndpoint('https://localhost')).toBe(false);
    expect(isPublicPdsEndpoint('https://intranet')).toBe(false);
    expect(isPublicPdsEndpoint('https://printer.local')).toBe(false);
    expect(isPublicPdsEndpoint('https://foo.localhost')).toBe(false);
  });

  it('rejects endpoints that smuggle credentials past the host check', () => {
    expect(isPublicPdsEndpoint('https://pds.example.com@evil.internal')).toBe(false);
    expect(isPublicPdsEndpoint('https://user:pass@10.0.0.1')).toBe(false);
  });

  it('rejects unparseable input', () => {
    expect(isPublicPdsEndpoint('not a url')).toBe(false);
    expect(isPublicPdsEndpoint('')).toBe(false);
  });
});

describe('pdsClient', () => {
  it('fails closed for a non-public endpoint', () => {
    expect(() => pdsClient('https://169.254.169.254')).toThrow();
    expect(() => pdsClient('http://pds.example.com')).toThrow();
  });

  it('builds (and caches) a client for a public PDS host', () => {
    const a = pdsClient('https://pds.example.com');
    const b = pdsClient('https://pds.example.com');
    expect(a).toBe(b);
  });
});
