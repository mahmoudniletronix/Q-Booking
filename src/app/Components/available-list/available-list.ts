import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { ScheduleServices, Slot, Ticket } from '../../service/schedule/schedule-services';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TicketReservation,
  TicketReservationDto,
} from '../../service/ticket-reservation/ticket-reservation';
import {
  AvailableServices,
  TicketReservationRequest,
} from '../../service/available/available-services';
import { Subscription } from 'rxjs';
import { AppToastService } from '../../service/Toastr/app-toast.service';

@Component({
  selector: 'app-available-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './available-list.html',
  styleUrl: './available-list.css',
})
export class AvailableList implements OnInit, OnDestroy {
  clinicId!: number;
  doctorId!: number;
  day!: string;
  dayName!: string;

  routeSub!: Subscription;

  slots: Slot[] = [];
  loading = false;

  mode: 'add' | 'edit' = 'add';
  selectedSlot: Slot | null = null;
  timeInfo = '';

  model: Ticket = { id: 0, patient: '', phone: '', status: 'Received' };

  lastCreatedTicket: TicketReservationDto | null = null;

  @ViewChild('formCard') formCard!: ElementRef<HTMLDivElement>;
  @ViewChild('patientInput') patientInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices,
    private ticketSrv: TicketReservation,
    private availableSrv: AvailableServices,
    private toast: AppToastService
  ) {
    this.routeSub = this.route.paramMap.subscribe((p) => {
      this.clinicId = +(p.get('clinicId') || 0);
      this.doctorId = +(p.get('doctorId') || 0);
      this.day = p.get('day') || '';

      if (this.clinicId) {
        this.sch.setSelectedClinic(this.clinicId);
        localStorage.setItem('qbook.clinicId', String(this.clinicId));
      }
      if (this.doctorId) {
        this.sch.setSelectedDoctor(this.doctorId);
        localStorage.setItem('qbook.doctorId', String(this.doctorId));
      }

      this.clearSelection();
      this.slots = [];
      this.lastCreatedTicket = null;

      if (!this.clinicId || !this.doctorId || !this.day) {
        this.loading = false;
        return;
      }

      this.dayName = this.sch.getDayNameFor(this.clinicId, this.doctorId, this.day, 'en');

      this.loading = true;
      this.loadSlots();
    });
  }

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((p) => {
      this.clinicId = +(p.get('clinicId') || 0);
      this.doctorId = +(p.get('doctorId') || 0);
      this.day = p.get('day') || '';

      this.clearSelection();
      this.slots = [];
      this.lastCreatedTicket = null;

      if (!this.clinicId || !this.doctorId || !this.day) {
        this.loading = false;
        return;
      }

      this.dayName = this.sch.getDayNameFor(this.clinicId, this.doctorId, this.day, 'en');

      this.loading = true;
      this.loadSlots();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  // ====================== loadSlots ======================
  private loadSlots() {
    this.slots = [];

    if (!this.clinicId || !this.doctorId || !this.day) {
      this.loading = false;
      return;
    }

    let meta = this.sch.getDayMeta(this.clinicId, this.doctorId, this.day);

    if (!meta) {
      meta = {
        waitingDurationMinutes: 30,
        firstStart: '09:00:00',
        lastFinish: '17:00:00',
        shifts: [],
      };
    }

    const durationMin = meta.waitingDurationMinutes ?? 30;
    const start = this.combine(this.day, meta.firstStart || '09:00:00');
    const end = this.combine(this.day, meta.lastFinish || '17:00:00');

    const allTimes: string[] = this.generateTimes(start, end, durationMin);

    const apiDate = this.formatUsDate(this.day);

    this.ticketSrv.getByServiceAndDate(this.doctorId, apiDate).subscribe({
      next: (list: TicketReservationDto[]) => {
        const reservedSet = new Set<string>();
        list.forEach((r) =>
          reservedSet.add((r.slotTime || this.extractTime(r.reservationDate)) ?? '')
        );

        const slots: Slot[] = [];
        allTimes.forEach((t, idx) => {
          if (reservedSet.has(t)) {
            const dto = list.find((x) => (x.slotTime || this.extractTime(x.reservationDate)) === t);
            const ticket: Ticket = {
              id: dto?.id ?? 0,
              patient: dto?.patientName ?? 'Booked',
              phone: dto?.phoneNumber ?? '',
              status: 'Received',
              timeSlot: t,
            };
            slots.push({ index: idx, timeSlot: t, type: 'received', ticket });
          } else {
            slots.push({ index: idx, timeSlot: t, type: 'empty', ticket: null });
          }
        });

        this.slots = slots.filter((s) => s.type === 'empty');
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load reservations for slots', err);
        this.loading = false;
        this.toast.error('Failed to load available slots. Please try again later.');
      },
    });
  }

  // ====================== Helpers ======================
  private combine(dayYmd: string, timeHms: string): Date {
    const d = new Date(`${dayYmd}T${timeHms}`);
    return isNaN(d.getTime()) ? new Date(dayYmd) : d;
  }

  private generateTimes(start: Date, end: Date, stepMin: number): string[] {
    const out: string[] = [];
    const ms = stepMin * 60 * 1000;
    for (let t = start.getTime(); t < end.getTime(); t += ms) {
      const dt = new Date(t);
      out.push(this.toHms(dt));
    }
    return out;
  }

  private toHms(d: Date): string {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private extractTime(raw: string): string {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return this.toHms(d);
  }

  formatTime(hms: string): string {
    if (!hms) return '';
    const [hStr, mStr] = hms.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr ?? '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  private formatUsDate(dayYmd: string): string {
    const d = new Date(dayYmd);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  isReserved(s: Slot): boolean {
    return s.type === 'received' || !!s.ticket;
  }

  // summary helpers
  summaryDate(t: TicketReservationDto | null): string {
    if (!t) return '';
    const d = new Date(t.reservationDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  summaryTime(t: TicketReservationDto | null): string {
    if (!t) return '';
    const raw = t.slotTime || this.extractTime(t.reservationDate);
    return this.formatTime(raw);
  }

  // ====================== Interaction ======================
  onSlotClick(s: Slot) {
    if (this.isReserved(s)) return;

    this.mode = 'add';
    this.selectedSlot = s;
    this.timeInfo = s.timeSlot;
    this.model = { id: 0, patient: '', phone: '', status: 'Received', timeSlot: this.timeInfo };

    setTimeout(() => {
      this.scrollToForm();
      this.focusPatient();
    }, 0);
  }

  private scrollToForm() {
    const el = this.formCard?.nativeElement;
    if (!el) return;

    const headerOffset = 90;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({ top, behavior: 'smooth' });
  }

  private focusPatient() {
    this.patientInput?.nativeElement?.focus();
  }

  save() {
    if (!this.selectedSlot) return;
    if (!this.model.patient || !this.model.phone) {
      this.toast.warning('Please enter both patient name and phone number.');
      return;
    }

    const payload: TicketReservationRequest = {
      slotTime: this.selectedSlot.timeSlot,
      patientName: this.model.patient,
      phoneNumber: this.model.phone,
      serviceId: this.doctorId,
      branchId: this.getBranchId(),
      reservationDateBase: new Date(this.day).toISOString(),
    };

    this.availableSrv.createReservation(payload).subscribe({
      next: (created) => {
        // store last created ticket for summary
        this.lastCreatedTicket = created;

        // refresh schedule so time slots are updated
        const d = new Date(this.day);
        this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
        this.loadSlots();

        // reset form but keep selected slot in case user wants to add more
        this.model = {
          id: 0,
          patient: '',
          phone: '',
          status: 'Received',
          timeSlot: this.timeInfo,
        };

        this.toast.success('Reservation created successfully.');
      },
      error: (err) => {
        console.error('Reservation error', err);
        this.toast.error('Failed to create reservation. Please try again later.');
      },
    });
  }

  private getBranchId(): number {
    const fromSignal = this.sch.selectedBranchId();
    if (fromSignal && fromSignal > 0) return fromSignal;
    const fromParam = +(this.route.snapshot.paramMap.get('branchId') || 0);
    if (fromParam > 0) return fromParam;
    const fromQuery = +(this.route.snapshot.queryParamMap.get('branchId') || 0);
    if (fromQuery > 0) return fromQuery;
    return 0;
  }

  clearSelection() {
    this.selectedSlot = null;
    this.timeInfo = '';
    this.mode = 'add';
    this.model = { id: 0, patient: '', phone: '', status: 'Received' };
  }

  back() {
    this.router.navigate(['/']);
  }

  trackBySlot = (_: number, s: Slot) => s.index;
}
