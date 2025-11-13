import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environment/environment';
import { Observable, map } from 'rxjs';

export interface TicketSearchResultDto {
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
  slotTime: string;
  isActive: boolean;
  branchName: string;
  serviceName: string;
  serviceParentName: string;
}

@Injectable({
  providedIn: 'root',
})
export class SearchTicketService {
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
}
