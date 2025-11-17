import { Injectable } from '@angular/core';
import { environment } from '../../../environment/environment';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, tap, catchError, throwError } from 'rxjs';
import { TicketSearchResultDto } from '../global-search/ticket-search-box';
import { AppToastService } from '../Toastr/app-toast.service';

interface ApiResponseBase {
  isSuccess: boolean;
  message?: string;
  messageType?: 'success' | 'error' | 'warning' | 'info';
  errors?: string[];
}

interface ApiResponseArray<T> extends ApiResponseBase {
  response: T[];
}

export interface TicketReservationDto {
  id: number;
  serviceId: number;
  branchId: number;
  number: string;
  reservationDate: string;
  createDate: string;
  serviceWorkFlow: string;
  customerInput: string;
  patientName: string;
  phoneNumber: string;
  slotTime?: string;
  isActive: boolean;
}

export interface TicketReservationUpdateCommand {
  id: number;
  slotTime: string;
  patientName: string;
  phoneNumber: string;
  serviceId: number;
  branchId: number;
  isCancel: boolean;
  reservationDateBase: string;
}

export interface TicketPrintDto {
  number?: string;

  serviceEnglishName?: string;
  serviceArabicName?: string;

  parentServiceEnglishName?: string;
  parentServiceArabicName?: string;

  waitingCount?: number;

  branchName?: string;
  branchNameEn?: string;
  branchNameAr?: string;

  customerInput?: string;
  customerInfo?: string;

  printDate?: string;
  printTime?: string;

  averageWaitingTime?: number;
}

@Injectable({ providedIn: 'root' })
export class TicketReservation {
  private readonly baseUrl = environment.baseUrl;

  constructor(private http: HttpClient, private toast: AppToastService) {}

  // ================== Helpers ==================

  private extractErrorMessage(api?: ApiResponseBase | null): string | null {
    if (!api) return null;

    if (api.message && api.message.trim()) {
      return api.message;
    }
    if (api.errors && api.errors.length) {
      const first = api.errors.find((x) => !!x && x.trim()) || api.errors[0];
      return first || null;
    }
    return null;
  }

  private handleHttpError(
    err: HttpErrorResponse,
    fallbackMsg: string,
    opts?: { rethrowCode?: string }
  ) {
    const api = err?.error as ApiResponseBase | undefined;
    const msg = this.extractErrorMessage(api) || fallbackMsg;

    if (msg.includes('Selected time is outside the service schedule')) {
      this.toast.warning(
        "The selected time is outside the new doctor's schedule. Please choose another time."
      );
      return throwError(() =>
        Object.assign(new Error('OUTSIDE_SCHEDULE'), {
          code: 'OUTSIDE_SCHEDULE',
          api,
          http: err,
        })
      );
    }

    if (api) {
      this.toast.showApiResponse(api, {
        defaultSuccess: fallbackMsg,
      });
    } else {
      this.toast.error(fallbackMsg);
    }

    return throwError(() => err);
  }

  // ================== APIs ==================

  searchTickets(searchTerm: string): Observable<TicketSearchResultDto[]> {
    const params = new HttpParams().set('searchTerm', searchTerm);

    return this.http
      .get<{ item: TicketSearchResultDto[] }>(`${this.baseUrl}/ticket-reservation/search-ticket`, {
        params,
      })
      .pipe(map((res) => res?.item || []));
  }

  getByServiceAndDate(serviceId: number, dateUs: string): Observable<TicketReservationDto[]> {
    const params = new HttpParams().set('serviceId', serviceId).set('date', dateUs);

    return this.http
      .get<ApiResponseArray<TicketReservationDto>>(`${this.baseUrl}/ticket-reservation`, { params })
      .pipe(
        tap((res) => {
          this.toast.showApiResponse(res, {
            defaultSuccess: 'Tickets loaded successfully.',
          });
        }),
        map((res) => res?.response || []),
        catchError((err) =>
          this.handleHttpError(err, 'Failed to load tickets. Please try again later.')
        )
      );
  }

  moveReservation(id: number, newServiceId: number): Observable<ApiResponseBase> {
    return this.http
      .put<ApiResponseBase>(`${this.baseUrl}/ticket-reservation/${id}/move`, {
        serviceId: newServiceId,
      })
      .pipe(
        tap((res) => {
          this.toast.showApiResponse(res, {
            defaultSuccess: 'Reservation moved successfully.',
          });
        }),
        catchError((err) =>
          this.handleHttpError(err, 'Failed to move reservation. Please try again later.')
        )
      );
  }

  updateReservation(cmd: TicketReservationUpdateCommand): Observable<ApiResponseBase> {
    const url = `${this.baseUrl}/ticket-reservation`;
    return this.http.put<ApiResponseBase>(url, cmd).pipe(
      tap((res) => {
        this.toast.showApiResponse(res, {
          defaultSuccess: cmd.isCancel
            ? 'Reservation cancelled successfully.'
            : 'Reservation updated successfully.',
        });
      }),
      catchError((err) =>
        this.handleHttpError(err, 'Failed to update reservation. Please try again later.')
      )
    );
  }

  bulkMove(ids: number[], newServiceId: number): Observable<ApiResponseBase> {
    return this.http
      .post<ApiResponseBase>(`${this.baseUrl}/ticket-reservation/move/bulk`, {
        ids,
        serviceId: newServiceId,
      })
      .pipe(
        tap((res) => {
          this.toast.showApiResponse(res, {
            defaultSuccess: 'Selected reservations moved successfully.',
          });
        }),
        catchError((err) =>
          this.handleHttpError(err, 'Failed to move selected reservations. Please try again later.')
        )
      );
  }

  bulkCancel(ids: number[], note: string): Observable<ApiResponseBase> {
    return this.http
      .post<ApiResponseBase>(`${this.baseUrl}/ticket-reservation/cancel/bulk`, { ids, note })
      .pipe(
        tap((res) => {
          this.toast.showApiResponse(res, {
            defaultSuccess: 'Selected reservations cancelled successfully.',
          });
        }),
        catchError((err) =>
          this.handleHttpError(
            err,
            'Failed to cancel selected reservations. Please try again later.'
          )
        )
      );
  }

  printFromReservation(reservationId: number): Observable<Blob> {
    const url = `${this.baseUrl}/ticket-reservation/api/tickets/from-reservation/${reservationId}`;
    return this.http
      .post(url, null, { responseType: 'blob' })
      .pipe(
        catchError((err) =>
          this.handleHttpError(err, 'Failed to print ticket. Please try again later.')
        )
      );
  }
}
