import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SearchTicketService,
  TicketSearchResultDto,
} from '../../service/global-search/ticket-search-box';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { TicketSearchBusService } from '../../service/global-search/ticket-search.service';
import { LanguageService } from '../../service/lang/language.service';

@Component({
  selector: 'app-ticket-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-search-box.html',
  styleUrls: ['./ticket-search-box.css'],
})
export class TicketSearchBox implements OnDestroy {
  searchTerm = '';
  results: TicketSearchResultDto[] = [];
  loading = false;

  private search$ = new Subject<string>();
  private sub?: Subscription;

  constructor(
    private searchSrv: SearchTicketService,
    public bus: TicketSearchBusService,
    private languageService: LanguageService
  ) {
    this.sub = this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          const trimmed = term?.trim() || '';
          if (!trimmed || trimmed.length < 2) {
            this.results = [];
            this.loading = false;
            this.bus.publishResults([], trimmed);
            return of([]);
          }

          this.loading = true;
          return this.searchSrv.searchTickets(trimmed);
        })
      )
      .subscribe({
        next: (items) => {
          this.results = items || [];
          this.loading = false;
          this.bus.publishResults(this.results, this.searchTerm.trim());
        },
        error: (err) => {
          console.error('search error', err);
          this.loading = false;
          this.results = [];
          this.bus.publishResults([], this.searchTerm.trim());
        },
      });
  }

  // ========= لغة =========
  isAr(): boolean {
    return this.languageService.lang() === 'ar';
  }

  onInput(value: string) {
    this.searchTerm = value;
    this.search$.next(value);
  }

  private normalizeDateOnly(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private isPastDate(dateInput: string | Date | null | undefined): boolean {
    const d = this.normalizeDateOnly(dateInput);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }

  getStatusLabel(item: TicketSearchResultDto): string {
    if (!item.isActive && this.isPastDate(item.reservationDate)) {
      return this.isAr() ? 'لم يحضر' : 'Missed';
    }
    return item.isActive ? (this.isAr() ? 'نشط' : 'Active') : this.isAr() ? 'غير نشط' : 'Inactive';
  }

  getStatusClass(item: TicketSearchResultDto): string {
    if (item.isActive) return 'bg-success text-white';
    if (this.isPastDate(item.reservationDate)) return 'bg-warning text-dark';
    return 'bg-secondary text-light';
  }

  trackById(_index: number, item: TicketSearchResultDto) {
    return item.id;
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
