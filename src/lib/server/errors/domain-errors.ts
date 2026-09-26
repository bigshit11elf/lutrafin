export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly safeMessage = message
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class DatabaseUnavailable extends AppError {
  constructor(message = 'Database is unavailable') {
    super(message, 'DatabaseUnavailable', 'Database is unavailable.');
  }
}

export class JellyfinUnavailable extends AppError {
  constructor(message = 'Jellyfin is unavailable') {
    super(message, 'JellyfinUnavailable', 'Jellyfin is currently unavailable.');
  }
}

export class JellyfinUnauthorized extends AppError {
  constructor(message = 'Jellyfin credentials are unauthorized') {
    super(
      message,
      'JellyfinUnauthorized',
      'Jellyfin credentials are not authorized.'
    );
  }
}

export class ProviderUnavailable extends AppError {
  constructor(provider: string, message = 'Provider is unavailable') {
    super(
      `${provider}: ${message}`,
      'ProviderUnavailable',
      'Metadata provider is unavailable.'
    );
  }
}

export class ProviderRateLimited extends AppError {
  constructor(provider: string, message = 'Provider rate limit reached') {
    super(
      `${provider}: ${message}`,
      'ProviderRateLimited',
      'Metadata provider is rate limited.'
    );
  }
}

export class ProviderUnauthorized extends AppError {
  constructor(
    provider: string,
    message = 'Provider credentials are unauthorized'
  ) {
    super(
      `${provider}: ${message}`,
      'ProviderUnauthorized',
      'Metadata provider is not authorized.'
    );
  }
}

export class MetadataUnresolved extends AppError {
  constructor(message = 'Metadata could not be resolved') {
    super(
      message,
      'MetadataUnresolved',
      'Metadata source could not be resolved.'
    );
  }
}

export class InvalidProviderResponse extends AppError {
  constructor(
    provider: string,
    message = 'Provider returned an invalid response'
  ) {
    super(
      `${provider}: ${message}`,
      'InvalidProviderResponse',
      'Metadata provider response is invalid.'
    );
  }
}
