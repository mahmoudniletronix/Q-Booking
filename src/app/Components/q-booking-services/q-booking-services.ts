import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Doctor {
  id: number;
  name: string;
}

type TicketStatus = 'Received' | 'Not Received';

interface Ticket {
  id: number;
  patient: string;
  phone: string;
  status: TicketStatus;
  timeSlot?: string;
}

interface Clinic {
  id: number;
  name: string;
  doctors: Doctor[];
  schedule: Record<number, (Ticket | null)[]>;
}

type View = 'table' | 'patientSummary' | 'editPatient' | 'addPatient';

interface Slot {
  index: number;
  type: 'received' | 'notReceived' | 'empty';
  ticket?: Ticket | null;
  timeSlot?: string;
}

@Component({
  selector: 'app-q-booking-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './q-booking-services.html',
  styleUrl: './q-booking-services.css',
})
export class QBookingServices implements OnInit {
  constructor(private cdr: ChangeDetectorRef) {}

  clinics: Clinic[] = [
    {
      id: 1,
      name: 'Gynecology and Obstetrics Clinic',
      doctors: [
        { id: 101, name: 'Dr. Ali Khalil' },
        { id: 102, name: 'Dr. Sara Ahmed' },
        { id: 103, name: 'Dr. Mohamad Ali' },
        { id: 104, name: 'Dr. Hossam Nasr' },
        { id: 105, name: 'Dr. Laila Fathy' },
      ],
      schedule: {},
    },
    {
      id: 2,
      name: 'Cardiology Clinic',
      doctors: [
        { id: 201, name: 'Dr. Hossam Nasr' },
        { id: 202, name: 'Dr. Laila Fathy' },
        { id: 203, name: 'Dr. Mostafa Gamal' },
        { id: 204, name: 'Dr. Nancy Adel' },
        { id: 205, name: 'Dr. Mostafa Gamal' },
        { id: 206, name: 'Dr. Nancy Adel' },
      ],
      schedule: {},
    },
    {
      id: 3,
      name: 'Orthopedic Clinic',
      doctors: [
        { id: 301, name: 'Dr. Mostafa Gamal' },
        { id: 302, name: 'Dr. Nancy Adel' },
        { id: 303, name: 'Dr. Mostafa Gamal' },
        { id: 304, name: 'Dr. Nancy Adel' },
        { id: 305, name: 'Dr. Mostafa Gamal' },
        { id: 306, name: 'Dr. Nancy Adel' },
      ],
      schedule: {},
    },
  ];

  readonly TOTAL_SLOTS = 55;
  readonly WORKING_HOURS = 12;
  readonly SLOTS_PER_HOUR = 2;

  selectedClinicId: number | null = null;
  days: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

  schedules: Record<number, Record<number, Record<number, (Ticket | null)[]>>> = {};

  currentView: View = 'table';
  selectedDoctor: Doctor | null = null;
  selectedDay: number | null = null;
  selectedSlotIndex: number | null = null;
  selectedTicket: Ticket | null = null;

  editModel: Ticket = { id: 0, patient: '', phone: '', status: 'Received' };
  newPatient: Ticket = { id: 0, patient: '', phone: '', status: 'Received' };

  private generateTimeSlots(): string[] {
    const timeSlots: string[] = [];
    const startHour = 8;
    const endHour = 20;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let slot = 0; slot < this.SLOTS_PER_HOUR; slot++) {
        const minutes = slot === 0 ? '00' : '30';
        const period = hour < 12 ? 'AM' : 'PM';
        const displayHour = hour > 12 ? hour - 12 : hour;
        timeSlots.push(`${displayHour}:${minutes} ${period}`);
      }
    }

    return timeSlots;
  }

  ngOnInit(): void {
    const timeSlots = this.generateTimeSlots();
    const randomName = (i: number) =>
      ['Ahmed', 'Mona', 'Sara', 'Omar', 'Yara', 'Mostafa', 'Nour', 'Ali', 'Hala', 'Khaled'][i % 10];

    for (const clinic of this.clinics) {
      this.schedules[clinic.id] = {};
      for (const doc of clinic.doctors) {
        this.schedules[clinic.id][doc.id] = {};
        for (const day of this.days) {
          const arr: (Ticket | null)[] = new Array(this.TOTAL_SLOTS).fill(null);

          for (let idx = 0; idx < this.TOTAL_SLOTS; idx++) {
            const fill = Math.random() < 0.7;
            if (fill && idx < timeSlots.length) {
              const received = Math.random() < 0.65;
              arr[idx] = {
                id: Number(`${day}${idx}`) + 1000,
                patient: `${randomName(idx)} ${idx + 1}`,
                phone: `05${Math.floor(10000000 + Math.random() * 89999999)}`,
                status: received ? 'Received' : 'Not Received',
                timeSlot: timeSlots[idx],
              };
            }
          }

          this.schedules[clinic.id][doc.id][day] = arr;
        }
      }
    }
  }

  get selectedClinic(): Clinic | undefined {
    return this.clinics.find((c) => c.id === this.selectedClinicId!);
  }

  private daySlots(clinicId: number, doctorId: number, day: number): (Ticket | null)[] {
    return this.schedules[clinicId]?.[doctorId]?.[day] ?? new Array(this.TOTAL_SLOTS).fill(null);
  }

  getSlots(clinicId: number, doctorId: number, day: number): Slot[] {
    const timeSlots = this.generateTimeSlots();
    const arr = this.daySlots(clinicId, doctorId, day);

    return arr.map((tk, index) => {
      if (!tk)
        return {
          index,
          type: 'empty',
          timeSlot: index < timeSlots.length ? timeSlots[index] : 'Extra Slot',
        } as Slot;

      return {
        index,
        type: tk.status === 'Received' ? 'received' : 'notReceived',
        ticket: tk,
        timeSlot: tk.timeSlot || (index < timeSlots.length ? timeSlots[index] : 'Extra Slot'),
      } as Slot;
    });
  }

  getTimeDistribution(
    clinicId: number,
    doctorId: number,
    day: number
  ): { time: string; count: number }[] {
    const slots = this.getSlots(clinicId, doctorId, day);
    const timeMap = new Map<string, number>();

    slots.forEach((slot) => {
      if (slot.timeSlot) {
        const currentCount = timeMap.get(slot.timeSlot) || 0;
        timeMap.set(slot.timeSlot, currentCount + 1);
      }
    });

    return Array.from(timeMap.entries()).map(([time, count]) => ({ time, count }));
  }

  totalCount(clinicId: number, doctorId: number, day: number): number {
    return this.daySlots(clinicId, doctorId, day).filter(Boolean).length;
  }

  onSlotClick(clinicId: number, doctor: Doctor, day: number, slot: Slot): void {
    this.selectedClinicId = clinicId;
    this.selectedDoctor = doctor;
    this.selectedDay = day;
    this.selectedSlotIndex = slot.index;

    if (slot.type === 'empty') {
      this.newPatient = {
        id: 0,
        patient: '',
        phone: '',
        status: 'Received',
        timeSlot: slot.timeSlot,
      };
      this.currentView = 'addPatient';
      return;
    }

    this.selectedTicket = { ...(slot.ticket as Ticket) };
    this.currentView = 'patientSummary';
  }

  goEditSelected(): void {
    if (!this.selectedTicket) return;
    this.editModel = { ...this.selectedTicket };
    this.currentView = 'editPatient';
  }

  goSummary(): void {
    this.currentView = 'patientSummary';
  }

  backToTable(): void {
    this.currentView = 'table';
    this.selectedDoctor = null;
    this.selectedDay = null;
    this.selectedSlotIndex = null;
    this.selectedTicket = null;
    this.editModel = { id: 0, patient: '', phone: '', status: 'Received' };
  }

  addPatient(): void {
    if (
      this.newPatient.patient &&
      this.newPatient.phone &&
      this.selectedDoctor &&
      this.selectedDay &&
      this.selectedClinicId &&
      this.selectedSlotIndex !== null
    ) {
      const newTicket: Ticket = {
        id: Date.now(),
        patient: this.newPatient.patient,
        phone: this.newPatient.phone,
        status: this.newPatient.status,
        timeSlot: this.newPatient.timeSlot,
      };

      if (!this.schedules[this.selectedClinicId][this.selectedDoctor.id][this.selectedDay]) {
        this.schedules[this.selectedClinicId][this.selectedDoctor.id][this.selectedDay] = new Array(
          this.TOTAL_SLOTS
        ).fill(null);
      }

      this.schedules[this.selectedClinicId][this.selectedDoctor.id][this.selectedDay][
        this.selectedSlotIndex
      ] = newTicket;

      this.forceTableUpdate();
      alert('✅ Patient added successfully!');
      this.backToTable();
    }
  }

  private forceTableUpdate(): void {
    this.schedules = { ...this.schedules };
    this.cdr.detectChanges();
    this.days = [...this.days];
  }

  printSummary(): void {
    window.print();
  }

  saveEdit(): void {
    if (!this.selectedTicket) return;

    this.selectedTicket.patient = this.editModel.patient;
    this.selectedTicket.phone = this.editModel.phone;
    this.selectedTicket.status = this.editModel.status;

    this.forceTableUpdate();
    alert('✅ Patient updated successfully!');
    this.backToTable();
  }

  updatePatient(): void {
    if (this.selectedTicket && this.selectedDoctor && this.selectedDay && this.selectedClinicId) {
      const tickets = this.daySlots(
        this.selectedClinicId,
        this.selectedDoctor.id,
        this.selectedDay
      );
      const index = tickets.findIndex((t) => t?.id === this.selectedTicket!.id);

      if (index !== -1) {
        tickets[index] = { ...this.selectedTicket };
        this.forceTableUpdate();
        alert('✅ Patient updated successfully!');
      }
      this.backToTable();
    }
  }

  getSlotInfo(slot: Slot): string {
    if (slot.type === 'empty') {
      return slot.timeSlot ? `Empty - ${slot.timeSlot}` : 'Empty Slot';
    }
    return slot.timeSlot ? `${slot.timeSlot}` : 'No Time Info';
  }
}
