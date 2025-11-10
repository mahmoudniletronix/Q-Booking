import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ScheduleServices, Slot, Ticket } from '../../service/schedule/schedule-services';
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
    const all = this.sch
      .slots(this.clinicId, this.doctorId, this.day)
      .filter((s) => s.timeSlot && !s.timeSlot.toLowerCase().includes('extra'));

    this.slots = all;
  }

  isReserved(s: Slot): boolean {
    if ((s as any).ticket) return true;
    if ((s as any).type && (s as any).type !== 'empty') return true;
    return false;
  }

  onSlotClick(s: Slot) {
    this.mode = 'add';
    this.selectedSlot = s;
    this.timeInfo = s.timeSlot || '';

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

    if (this.mode === 'add') {
      const payload: TicketReservationRequest = {
        slotTime: this.selectedSlot.timeSlot || '',
        patientName: this.model.patient,
        phoneNumber: this.model.phone,
        serviceId: this.doctorId,
        branchId: this.getBranchId(),
        reservationDateBase: this.getReservationDateBaseIso(),
      };

      this.availableSrv.createReservation(payload).subscribe({
        next: (res) => {
          const newTicket: Ticket = {
            id: res?.id || Date.now(),
            patient: this.model.patient,
            phone: this.model.phone,
            status: this.model.status,
            timeSlot: this.selectedSlot?.timeSlot,
          };

          this.sch.addAtSlot(
            this.clinicId,
            this.doctorId,
            this.day,
            this.selectedSlot!.index,
            newTicket
          );

          this.loadSlots();
          this.clearSelection();

          alert('✅ Reservation created successfully.');
        },
        error: (err) => {
          console.error('Reservation error', err);
          alert('❌ Failed to create reservation. Please try again.');
        },
      });
    } else {
      this.sch.updateTicket(this.clinicId, this.doctorId, this.day, this.model);
      this.loadSlots();
      this.clearSelection();
      alert('✅ Patient updated successfully!');
    }
  }

  private getBranchId(): number {
    try {
      const b = (this.sch as any).selectedBranchId?.();
      return typeof b === 'number' ? b : 0;
    } catch {
      return 0;
    }
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
