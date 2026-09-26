declare global {
  namespace App {
    interface Locals {
      requestId: string;
      admin: boolean;
    }
  }
}

export {};
