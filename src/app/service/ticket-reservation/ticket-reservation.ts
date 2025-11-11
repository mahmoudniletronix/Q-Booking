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
}

@Injectable({
  providedIn: 'root',
})
export class TicketReservation {
  private readonly baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getByServiceAndDate(serviceId: number, date: string): Observable<TicketReservationDto[]> {
    const params = new HttpParams().set('serviceId', serviceId).set('date', date);

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
    return this.http.put(`${this.baseUrl}/ticket-reservation/cancel/bulk`, {
      ids,
      note,
    });
  }
}
