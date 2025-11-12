import { Injectable } from '@angular/core';
import { environment } from '../../../environment/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

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

export interface TicketPrintDto {
  branchName: string;
  customerInfo: string;
  customerInput: string;
  number: string;
  parentServiceEnglishName: string;
  printDate: string;
  printTime: string;
  serviceEnglishName: string;
  waitingCount: number;
}

@Injectable({ providedIn: 'root' })
export class TicketReservation {
  private readonly baseUrl = environment.baseUrl;
  constructor(private http: HttpClient) {}

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

  bulkMove(ids: number[], newServiceId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/ticket-reservation/move/bulk`, {
      ids,
      serviceId: newServiceId,
    });
  }

  bulkCancel(ids: number[], note: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/ticket-reservation/cancel/bulk`, { ids, note });
  }

  printFromReservation(reservationId: number): Observable<Blob> {
    const url = `${this.baseUrl}/ticket-reservation/api/tickets/from-reservation/${reservationId}`;
    return this.http.post(url, null, { responseType: 'blob' });
  }
}
