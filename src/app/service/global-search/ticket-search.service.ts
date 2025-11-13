import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { TicketSearchResultDto } from './ticket-search-box';
export interface GlobalSearchResultsPayload {
  items: TicketSearchResultDto[];
  term: string;
}

@Injectable({
  providedIn: 'root',
})
export class TicketSearchBusService {
  private selectionSource = new Subject<TicketSearchResultDto>();
  selection$ = this.selectionSource.asObservable();

  publishSelection(item: TicketSearchResultDto) {
    this.selectionSource.next(item);
  }

  private resultsSource = new Subject<GlobalSearchResultsPayload>();
  results$ = this.resultsSource.asObservable();

  publishResults(items: TicketSearchResultDto[], term: string) {
    this.resultsSource.next({ items, term });
  }
}
