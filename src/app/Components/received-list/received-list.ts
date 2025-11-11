import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ScheduleServices, Doctor } from '../../service/schedule/schedule-services';
import {
  TicketReservation,
  TicketReservationDto,
} from '../../service/ticket-reservation/ticket-reservation';

interface ReservedTicketVm extends TicketReservationDto {
  timeSlot: string;
}

@Component({
  selector: 'app-received-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './received-list.html',
  styleUrls: ['./received-list.css'],
})
export class ReceivedList {
  clinicId!: number;
  doctorId!: number;
  day!: string;
  dayLabel = '';

  items: ReservedTicketVm[] = [];
  loading = false;

  selectedIds = new Set<number>();
  focusedTicket: ReservedTicketVm | null = null;

  targetDoctorId: number | null = null;
  targetDoctors: Doctor[] = [];

  cancelNote = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices,
    private ticketSrv: TicketReservation
  ) {
    this.route.paramMap.subscribe((p) => {
      this.clinicId = +(p.get('clinicId') || 0);
      this.doctorId = +(p.get('doctorId') || 0);
      this.day = p.get('day') || '';

      this.dayLabel = this.buildDayLabel(this.day);

      this.ensureDoctorsLoaded();
      this.loadReserved();
    });
  }

  // ================== Load ==================

  private ensureDoctorsLoaded() {
    const existed = this.sch.getDoctorsByClinic(this.clinicId);
    if (!existed || !existed.length) {
      const d = new Date(this.day || new Date());
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      this.sch.loadSchedule(this.clinicId, year, month);
    }

    this.targetDoctors = this.sch.getDoctorsByClinic(this.clinicId) || [];
  }

  private loadReserved() {
    if (!this.doctorId || !this.day) return;

    const apiDate = this.formatApiDate(this.day);
    this.loading = true;

    this.ticketSrv.getByServiceAndDate(this.doctorId, apiDate).subscribe({
      next: (list) => {
        this.items = list.map((x) => ({
          ...x,
          timeSlot: this.extractTime(x.reservationDate),
        }));
        this.selectedIds.clear();
        this.focusedTicket = this.items[0] || null;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load reserved tickets', err);
        this.items = [];
        this.selectedIds.clear();
        this.focusedTicket = null;
        this.loading = false;
      },
    });
  }

  // ================== Helpers ==================

  private buildDayLabel(raw: string): string {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString();
    }
    return raw;
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

  // ================== Selection ==================

  trackById = (_: number, t: ReservedTicketVm) => t.id;

  onTicketClick(t: ReservedTicketVm) {
    if (this.selectedIds.has(t.id)) {
      this.selectedIds.delete(t.id);
    } else {
      this.selectedIds.add(t.id);
    }
    this.focusedTicket = t;
  }

  selectAll() {
    this.selectedIds.clear();
    this.items.forEach((i) => this.selectedIds.add(i.id));
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  get allSelected(): boolean {
    return this.items.length > 0 && this.selectedIds.size === this.items.length;
  }

  // ================== Move ==================

  canMove(): boolean {
    return (
      this.selectedIds.size > 0 && !!this.targetDoctorId && this.targetDoctorId !== this.doctorId
    );
  }

  moveSelected() {
    if (!this.canMove() || !this.targetDoctorId) return;

    const ids = Array.from(this.selectedIds);

    this.ticketSrv.bulkMove(ids, this.targetDoctorId!).subscribe({
      next: () => {
        this.loadReserved();
      },
      error: (err) => {
        console.error('Move tickets error', err);
        alert('❌ Failed to move selected tickets.');
      },
    });
  }

  // ================== Change Day ==================

  onDayChange(newDay: string) {
    if (!newDay) return;
    this.router.navigate(['/patient/received', this.clinicId, this.doctorId, newDay]);
  }

  // ================== Cancel ==================

  canCancel(): boolean {
    return this.selectedIds.size > 0 && !!this.cancelNote.trim();
  }

  cancelSelected() {
    if (!this.canCancel()) return;

    const ids = Array.from(this.selectedIds);
    const note = this.cancelNote.trim();

    this.ticketSrv.bulkCancel(ids, note).subscribe({
      next: () => {
        this.cancelNote = '';
        this.loadReserved();
      },
      error: (err) => {
        console.error('Cancel tickets error', err);
        alert('❌ Failed to cancel selected tickets.');
      },
    });
  }

  // ================== Ticket Actions ==================

  editTicket(t: ReservedTicketVm) {
    this.router.navigate(['/ticket-reservation/edit', t.id]);
  }

  printTicket(t: ReservedTicketVm) {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Ticket #${t.number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            .ticket {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 12px;
              margin-top: 8px;
            }
            .title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
            .row { margin-bottom: 4px; }
            .label { font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="title">Reserved Ticket #${t.number}</div>
            <div class="row"><span class="label">Doctor (ServiceId):</span> ${t.serviceId}</div>
            <div class="row"><span class="label">Patient:</span> ${t.patientName}</div>
            <div class="row"><span class="label">Phone:</span> ${t.phoneNumber}</div>
            <div class="row"><span class="label">Time:</span> ${this.extractTime(
              t.reservationDate
            )}</div>
            <div class="row"><span class="label">Created:</span> ${new Date(
              t.createDate
            ).toLocaleString()}</div>
            ${
              t.customerInput
                ? `<div class="row"><span class="label">Note:</span> ${t.customerInput}</div>`
                : ''
            }
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  back() {
    this.router.navigate(['/']);
  }
}
