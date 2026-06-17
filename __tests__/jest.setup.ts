import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// React Native expects __DEV__ as a global, define it for test environment
(global as any).__DEV__ = true;
