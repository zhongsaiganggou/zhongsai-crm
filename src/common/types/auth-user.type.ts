import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: UserRole;
  mobile: string;
}

