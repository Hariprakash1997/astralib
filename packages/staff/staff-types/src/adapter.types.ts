export interface StaffAdapters {
  hashPassword: (password: string) => Promise<string>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
}
