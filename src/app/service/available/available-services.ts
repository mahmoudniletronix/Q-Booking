import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environment/environment';
import { TicketReservationDto } from '../ticket-reservation/ticket-reservation';

export interface TicketReservationRequest {
  slotTime: string;
  patientName: string;
  phoneNumber: string;
  serviceId: number;
  branchId: number;
  reservationDateBase: string;
}

interface ApiResponse<T> {
  isSuccess: boolean;
  response: T;
  errors: any[];
}

@Injectable({ providedIn: 'root' })
export class AvailableServices {
  private readonly baseUrl = environment.baseUrl;
  constructor(private http: HttpClient) {}

  createReservation(payload: TicketReservationRequest): Observable<TicketReservationDto> {
    return this.http.post<any>(`${this.baseUrl}/ticket-reservation`, payload).pipe(
      map((raw) => {
        const responseWrapper = raw as ApiResponse<TicketReservationDto | TicketReservationDto[]>;

        const response =
          (responseWrapper as any).response ?? (responseWrapper as any).Response ?? raw;

        const data = Array.isArray(response) ? response[0] : response;

        return data as TicketReservationDto;
      })
    );
  }
}
