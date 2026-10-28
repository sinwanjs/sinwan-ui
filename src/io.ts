export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}
