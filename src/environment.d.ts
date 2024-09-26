declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: string;
      PORTABLE_EXECUTABLE_DIR: string;
    }
  }
}

export {};
