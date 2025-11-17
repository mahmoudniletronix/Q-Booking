export type ApiMessageType = 'success' | 'error' | 'warning' | 'info';

export interface ApiResponseBase {
  isSuccess: boolean;
  message?: string;
  messageType?: ApiMessageType;
  errors?: string[];
}

export interface ApiResponseArray<T> extends ApiResponseBase {
  response: T[];
}

export interface ApiPagedResponse<T> extends ApiResponseBase {
  response?: {
    items?: T[];
    total?: number;
  };
}
