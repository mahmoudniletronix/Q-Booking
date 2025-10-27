import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Doctor, ScheduleServices, Slot } from '../../service/schedule-services';

@Component({
  selector: 'app-q-booking-services',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './q-booking-services.html',
  styleUrls: ['./q-booking-services.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QBookingServices implements OnInit {
  constructor(public sch: ScheduleServices, private router: Router) {}

  ngOnInit(): void {}

  onClinicChange(id: number | null) {
    this.sch.selectedClinicId.set(id);
    if (id) this.sch.ensureClinicBuilt(id);
  }

  onSlotClick(clinicId: number, doctor: Doctor, day: number, slot: Slot) {
    this.sch.selectedDoctor.set(doctor);
    this.sch.selectedDay.set(day);

    if (slot.type === 'empty') {
      this.router.navigate(['/patient/add', clinicId, doctor.id, day, slot.index]);
      return;
    }
    const ticketId = slot.ticket?.id;
    if (ticketId == null) return;
    this.router.navigate(['/patient/edit', clinicId, doctor.id, day, ticketId]);
  }

  get selectedClinic() {
    const id = this.sch.selectedClinicId();
    return id ? this.sch.clinics.find((c) => c.id === id) ?? null : null;
  }

  get selectedClinicName(): string {
    return this.selectedClinic?.name ?? 'Select a clinic';
  }

  get selectedClinicDoctors() {
    return this.selectedClinic?.doctors ?? [];
  }

  ui = {
    showEmptyPicker: false,
    showReceivedList: false,
    clinicId: null as number | null,
    doctor: null as Doctor | null,
    day: null as number | null,
  };

  emptySlots: Slot[] = [];
  receivedSlots: Slot[] = [];

  counts(clinicId: number, doctorId: number, day: number) {
    const slots = this.sch.slots(clinicId, doctorId, day);
    let reserved = 0;
    let notReceived = 0;
    let empty = 0;

    for (const s of slots) {
      if (s.type === 'empty') empty++;
      else if (s.ticket?.status === 'Received') reserved++;
      else notReceived++;
    }
    const available = notReceived + empty;
    return { reserved, available, total: slots.length };
  }

  openEmptyPicker(clinicId: number, doctor: Doctor, day: number) {
    const all = this.sch.slots(clinicId, doctor.id, day);
    this.emptySlots = all.filter((s) => s.type === 'empty');
    this.ui = { showEmptyPicker: true, showReceivedList: false, clinicId, doctor, day };
  }

  openReceivedList(clinicId: number, doctor: Doctor, day: number) {
    const all = this.sch.slots(clinicId, doctor.id, day);
    this.receivedSlots = all.filter((s) => s.ticket && s.ticket.status === 'Received');
    this.ui = { showEmptyPicker: false, showReceivedList: true, clinicId, doctor, day };
  }

  closeOverlays() {
    this.ui.showEmptyPicker = false;
    this.ui.showReceivedList = false;
  }

  goAddTicket(clinicId: number, doctorId: number, day: number, slotIndex: number) {
    this.closeOverlays();
    this.router.navigate(['/patient/add', clinicId, doctorId, day, slotIndex]);
  }

  goEditTicket(clinicId: number, doctorId: number, day: number, ticketId: number) {
    this.closeOverlays();
    this.router.navigate(['/patient/edit', clinicId, doctorId, day, ticketId]);
  }

  trackByDay = (_: number, day: number) => day;
  trackByDoctor = (_: number, d: Doctor) => d.id;
  trackBySlot = (_: number, s: Slot) => s.index;
}
