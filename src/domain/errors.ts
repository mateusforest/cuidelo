export class DomainError extends Error {
  constructor(
    message: string,
    public code = 'invalid',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
