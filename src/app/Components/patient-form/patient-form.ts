import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ScheduleServices, Ticket } from '../../service/schedule/schedule-services';
import {
  AvailableServices,
  TicketReservationRequest,
} from '../../service/available/available-services';
import {
  TicketReservation,
  TicketReservationDto,
} from '../../service/ticket-reservation/ticket-reservation';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './patient-form.html',
  styleUrls: ['./patient-form.css'],
})
export class PatientForm {
  mode: 'add' | 'edit' = 'add';

  clinicId!: number;
  doctorId!: number;
  day!: string;
  slotIndex: number | null = null;
  ticketId: number | null = null;

  timeInfo = '';
  loading = true;

  model: Ticket = {
    id: 0,
    patient: '',
    phone: '',
    status: 'Received',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices,
    private availableSrv: AvailableServices,
    private ticketSrv: TicketReservation
  ) {
    this.route.params.subscribe((p) => {
      const path = this.route.snapshot.routeConfig?.path ?? '';

      if (path.startsWith('patient/add')) this.mode = 'add';
      if (path.startsWith('patient/edit')) this.mode = 'edit';

      this.clinicId = +p['clinicId'];
      this.doctorId = +p['doctorId'];
      this.day = p['day'];

      if (this.mode === 'add') {
        this.slotIndex = +p['slotIndex'];
        this.initAddMode();
      } else {
        this.ticketId = +p['ticketId'];
        this.initEditMode();
      }
    });
  }

  private initAddMode() {
    if (
      !this.clinicId ||
      !this.doctorId ||
      !this.day ||
      this.slotIndex == null ||
      isNaN(this.slotIndex)
    ) {
      this.loading = false;
      return;
    }

    const times = this.buildTimesForDay(this.day);
    const t = times[this.slotIndex] || '';
    this.timeInfo = t;
    this.model.timeSlot = t;
    this.loading = false;
  }

  private initEditMode() {
    if (!this.ticketId || !this.doctorId || !this.day) {
      this.loading = false;
      return;
    }

    const apiDateUs = this.formatUsDate(this.day); // MM/DD/YYYY

    this.ticketSrv.getByServiceAndDate(this.doctorId, apiDateUs).subscribe({
      next: (items: TicketReservationDto[]) => {
        const t = items.find((x) => x.id === this.ticketId) || null;

        if (t) {
          const hms =
            t.slotTime && t.slotTime.length >= 5
              ? this.ensureHms(t.slotTime)
              : this.extractHms(t.reservationDate);

          this.model = {
            id: t.id,
            patient: t.patientName,
            phone: t.phoneNumber,
            status: 'Received',
            timeSlot: hms,
          };
          this.timeInfo = hms;
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load ticket for edit', err);
        this.loading = false;
      },
    });
  }

  private buildTimesForDay(dayYmd: string): string[] {
    const meta = this.sch.getDayMeta(this.clinicId, this.doctorId, dayYmd);
    const durationMin = meta?.waitingDurationMinutes ?? 30;
    const start = this.combine(dayYmd, meta?.firstStart ?? '00:00:00');
    const end = this.combine(dayYmd, meta?.lastFinish ?? '23:59:59');
    return this.generateTimes(start, end, durationMin);
  }

  private combine(dayYmd: string, timeHms: string): Date {
    const d = new Date(`${dayYmd}T${this.ensureHms(timeHms)}`);
    return isNaN(d.getTime()) ? new Date(dayYmd) : d;
  }

  private ensureHms(val: string): string {
    if (!val) return '00:00:00';
    const parts = val.split(':');
    if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    if (parts.length >= 3)
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(
        2,
        '0'
      )}`;
    return val;
  }

  private generateTimes(start: Date, end: Date, stepMin: number): string[] {
    const out: string[] = [];
    const stepMs = stepMin * 60 * 1000;
    for (let t = start.getTime(); t < end.getTime(); t += stepMs) {
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

  private extractHms(raw: string): string {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return this.toHms(d);
  }

  private formatUsDate(dayYmd: string): string {
    const d = new Date(dayYmd);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  get displayTime(): string {
    if (!this.timeInfo) return '';
    const [hh, mm] = this.timeInfo.split(':');
    return `${hh}:${mm}`;
  }

  // =========== Save ===========
  save() {
    if (!this.model.patient || !this.model.phone) return;

    if (this.mode === 'add') {
      if (!this.timeInfo) return;

      const payload: TicketReservationRequest = {
        slotTime: this.timeInfo,
        patientName: this.model.patient,
        phoneNumber: this.model.phone,
        serviceId: this.doctorId,
        branchId: this.getBranchId(),
        reservationDateBase: this.getReservationDateBaseIso(),
      };

      this.availableSrv.createReservation(payload).subscribe({
        next: () => {
          const d = new Date(this.day);
          this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
          this.router.navigate(['/patient/available', this.clinicId, this.doctorId, this.day]);
        },
        error: (err) => {
          console.error('Create reservation error', err);
          alert('❌ Failed to create reservation.');
        },
      });
    } else {
      alert('ℹ️ Edit reservation is not implemented on backend yet.');
      this.goBack();
    }
  }

  // =========== Helpers ===========
  private getBranchId(): number {
    const fromSignal = this.sch.selectedBranchId();
    if (fromSignal && fromSignal > 0) return fromSignal;

    const branchFromParam = +(this.route.snapshot.paramMap.get('branchId') || 0);
    if (branchFromParam > 0) return branchFromParam;

    const branchFromQuery = +(this.route.snapshot.queryParamMap.get('branchId') || 0);
    if (branchFromQuery > 0) return branchFromQuery;

    return 0;
  }

  private getReservationDateBaseIso(): string {
    const d = new Date(this.day);
    if (!isNaN(d.getTime())) return d.toISOString();
    return new Date().toISOString();
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
