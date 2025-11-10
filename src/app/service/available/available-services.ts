import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';

export interface TicketReservationRequest {
  slotTime: string;
  patientName: string;
  phoneNumber: string;
  serviceId: number;  
  branchId: number;
  reservationDateBase: string;
}

@Injectable({
  providedIn: 'root',
})
export class AvailableServices {
  private readonly baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  createReservation(payload: TicketReservationRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/ticket-reservation`, payload);
  }
}
