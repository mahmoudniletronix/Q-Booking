import { Component } from '@angular/core';
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

@Component({
  selector: 'app-available-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './available-list.html',
  styleUrl: './available-list.css',
})
export class AvailableList {
  clinicId!: number;
  doctorId!: number;
  day!: string;
  dayName!: string;

  slots: Slot[] = [];
  loading = false;

  mode: 'add' | 'edit' = 'add';
  selectedSlot: Slot | null = null;
  timeInfo = '';

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
    private ticketSrv: TicketReservation,
    private availableSrv: AvailableServices
  ) {
    this.route.paramMap.subscribe((p) => {
      this.clinicId = +(p.get('clinicId') || 0);
      this.doctorId = +(p.get('doctorId') || 0);
      this.day = p.get('day') || '';

      this.dayName = this.sch.getDayNameFor(this.clinicId, this.doctorId, this.day, 'en');

      this.loadSlots();
      this.clearSelection();
    });
  }

  private loadSlots() {
    this.slots = [];

    if (!this.clinicId || !this.doctorId || !this.day) return;

    const dateObj = new Date(this.day);
    const stats = this.sch.countsFor(this.clinicId, this.doctorId, dateObj);

    // لو مفيش capacity أصلاً → مفيش اليوم دا
    if (!stats.total) {
      return;
    }

    this.loading = true;
    const apiDate = this.formatApiDate(this.day);

    this.ticketSrv.getByServiceAndDate(this.doctorId, apiDate).subscribe({
      next: (list: TicketReservationDto[]) => {
        const slots: Slot[] = [];

        // 1) السلات المحجوزة (من الباك)
        list.forEach((r, idx) => {
          const time = this.extractTime(r.reservationDate);
          const ticket: Ticket = {
            id: r.id,
            patient: r.patientName,
            phone: r.phoneNumber,
            status: 'Received',
            timeSlot: time,
          };

          slots.push({
            index: idx,
            timeSlot: time || `Slot ${idx + 1}`,
            type: 'received',
            ticket,
          });
        });

        const reservedCount = list.length;
        const total = stats.total;
        const availableCount = Math.max(total - reservedCount, 0);

        // 2) السلات المتاحة: عددها من الباك (capacity - reserved)
        for (let i = 0; i < availableCount; i++) {
          const index = reservedCount + i;
          slots.push({
            index,
            timeSlot: `Slot ${index + 1}`, // Label بسيط لحد ما يبقي عندك slotTime من الباك
            type: 'empty',
            ticket: null,
          });
        }

        this.slots = slots;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load reservations for slots', err);
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

  isReserved(s: Slot): boolean {
    return s.type === 'received' || !!s.ticket;
  }

  onSlotClick(s: Slot) {
    if (this.isReserved(s)) return;

    this.mode = 'add';
    this.selectedSlot = s;
    this.timeInfo = s.timeSlot;

    this.model = {
      id: 0,
      patient: '',
      phone: '',
      status: 'Received',
      timeSlot: this.timeInfo,
    };
  }

  save() {
    if (!this.selectedSlot) return;
    if (!this.model.patient || !this.model.phone) return;

    // الـ slotTime هنا هو اللي هيتفهم في الباك (اتفقوا عليه: ممكن تبقى "Slot 5" أو وقت حقيقي)
    const payload: TicketReservationRequest = {
      slotTime: this.selectedSlot.timeSlot,
      patientName: this.model.patient,
      phoneNumber: this.model.phone,
      serviceId: this.doctorId,
      branchId: this.getBranchId(),
      reservationDateBase: this.getReservationDateBaseIso(),
    };

    this.availableSrv.createReservation(payload).subscribe({
      next: () => {
        alert('✅ Reservation created successfully.');
        this.loadSlots(); // نعيد تحميل السلات عشان يظهر الحجز
        this.clearSelection();
      },
      error: (err) => {
        console.error('Reservation error', err);
        alert('❌ Failed to create reservation.');
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

  private getReservationDateBaseIso(): string {
    const d = new Date(this.day);
    if (!isNaN(d.getTime())) return d.toISOString();
    return new Date().toISOString();
  }

  clearSelection() {
    this.selectedSlot = null;
    this.timeInfo = '';
    this.mode = 'add';
    this.model = {
      id: 0,
      patient: '',
      phone: '',
      status: 'Received',
    };
  }

  back() {
    this.router.navigate(['/']);
  }

  trackBySlot = (_: number, s: Slot) => s.index;
}
