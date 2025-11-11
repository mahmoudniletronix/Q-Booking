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

  // =========== Init (Add Mode) ===========
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

    const label = this.sch.getTimeSlotLabel(this.clinicId, this.doctorId, this.day, this.slotIndex);

    this.timeInfo = label || '';
    this.model.timeSlot = label || '';
    this.loading = false;
  }

  // =========== Init (Edit Mode) ===========
  private initEditMode() {
    if (!this.ticketId || !this.doctorId || !this.day) {
      this.loading = false;
      return;
    }

    const apiDate = this.formatApiDate(this.day);

    this.ticketSrv.getByServiceAndDate(this.doctorId, apiDate).subscribe({
      next: (items: TicketReservationDto[]) => {
        const t = items.find((x) => x.id === this.ticketId) || null;

        if (t) {
          this.model = {
            id: t.id,
            patient: t.patientName,
            phone: t.phoneNumber,
            status: 'Received',
            timeSlot: this.extractTime(t.reservationDate),
          };
          this.timeInfo = this.model.timeSlot || '';
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load ticket for edit', err);
        this.loading = false;
      },
    });
  }

  private formatApiDate(raw: string): string {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;

    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  private extractTime(raw: string): string {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
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
          alert('  Reservation created successfully.');
          this.goBack();
        },
        error: (err) => {
          console.error('Create reservation error', err);
          alert('  Failed to create reservation.');
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
