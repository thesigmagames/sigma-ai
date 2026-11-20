/**
 * Sigma AI • Firestore Security Rules Verification Spec
 * Documents the automated test assertions for the "Dirty Dozen" adversarial payloads.
 */
export interface DirtyDozenScenario {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  { id: 1, name: 'Unauthenticated Guest Write', path: '/users/guest123/chats/chat1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified Email Spoofing', path: '/users/u1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Cross-Tenant PII Read', path: '/users/u1', operation: 'get', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Cross-Tenant Chat List Scraping', path: '/users/u1/chats', operation: 'list', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Identity Spoofing on Chat Create', path: '/users/u1/chats/c1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Self-Assigned Admin Shadow Field', path: '/users/u1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'ID Poisoning Attack', path: '/users/u1/chats/bad$id', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Backdated Client Timestamp Forgery', path: '/users/u1/chats/c1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Immutable Ownership Tampering', path: '/users/u1/chats/c1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Oversized String Denial-of-Wallet', path: '/users/u1/chats/c1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Invalid Enum Value Poisoning', path: '/users/u1/chats/c1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Orphaned Message Write', path: '/users/u1/chats/nonexistent/messages/m1', operation: 'create', expected: 'PERMISSION_DENIED' }
];
