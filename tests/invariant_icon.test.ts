import { API_KEYS } from './icon';

describe('API keys must not be exposed through public interfaces', () => {
  const payloads = [
    // Exact exploit case: attempt to extract keys through property access
    'API_KEYS',
    // Boundary case: attempt to access nested key structure
    'logoDev',
    // Valid input: unrelated property that shouldn't expose keys
    'someOtherProperty',
  ];

  test.each(payloads)('does not expose keys via %s', (payload) => {
    // Security property: API keys must not be accessible through
    // any public export or property that could be enumerated
    const exportedObject = API_KEYS;
    
    // If payload is a direct property name, verify it's not enumerable
    if (payload in exportedObject) {
      const descriptor = Object.getOwnPropertyDescriptor(exportedObject, payload);
      expect(descriptor?.enumerable).toBe(false);
    }
    
    // Additional check: ensure the object itself cannot be serialized
    // to expose keys through common attack vectors
    const jsonString = JSON.stringify(exportedObject);
    expect(jsonString).not.toMatch(/pk_/); // No logo.dev keys
    expect(jsonString).not.toMatch(/1id/); // No brandfetch keys
  });
});