import { Injectable, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

export type ApiMessageType = 'success' | 'error' | 'warning' | 'info';

export interface ApiResponseBase {
  isSuccess: boolean;
  message?: string;
  messageType?: ApiMessageType;
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class AppToastService {
  private toastr = inject(ToastrService);

  success(message: string, title = 'Success') {
    this.toastr.success(message, title);
  }

  error(message: string, title = 'Error') {
    this.toastr.error(message, title);
  }

  warning(message: string, title = 'Warning') {
    this.toastr.warning(message, title);
  }

  info(message: string, title = 'Info') {
    this.toastr.info(message, title);
  }

  showApiResponse(res: ApiResponseBase, opts?: { defaultSuccess?: string }) {
    if (res.message) {
      const title = res.message;
      this.showByType(res.messageType || 'info', title, title);
      return;
    }

    if (!res.isSuccess && res.errors && res.errors.length) {
      const title = res.errors[0];
      this.error(title, title);
      return;
    }

    if (res.isSuccess && opts?.defaultSuccess) {
      this.success(opts.defaultSuccess, opts.defaultSuccess);
    }
  }

  private showByType(type: ApiMessageType, msg: string, title: string) {
    switch (type) {
      case 'success':
        this.success(msg, title);
        break;
      case 'warning':
        this.warning(msg, title);
        break;
      case 'info':
        this.info(msg, title);
        break;
      case 'error':
      default:
        this.error(msg, title);
        break;
    }
  }
}
