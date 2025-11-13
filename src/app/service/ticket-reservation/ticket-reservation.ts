import { Injectable } from '@angular/core';
import { environment } from '../../../environment/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { TicketSearchResultDto } from '../global-search/ticket-search-box';

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
  constructor(private http: HttpClient) {}

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
      .get<{ item: TicketReservationDto[] }>(`${this.baseUrl}/ticket-reservation`, { params })
      .pipe(map((res) => res?.item || []));
  }

  moveReservation(id: number, newServiceId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/ticket-reservation/${id}/move`, {
      serviceId: newServiceId,
    });
  }

  updateReservation(cmd: TicketReservationUpdateCommand): Observable<any> {
    const url = `${this.baseUrl}/ticket-reservation`;
    return this.http.put(url, cmd);
  }

  bulkMove(ids: number[], newServiceId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/ticket-reservation/move/bulk`, {
      ids,
      serviceId: newServiceId,
    });
  }

  bulkCancel(ids: number[], note: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/ticket-reservation/cancel/bulk`, { ids, note });
  }

  printFromReservation(reservationId: number): Observable<Blob> {
    const url = `${this.baseUrl}/ticket-reservation/api/tickets/from-reservation/${reservationId}`;
    return this.http.post(url, null, { responseType: 'blob' });
  }
}
