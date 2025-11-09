import { Injectable, signal } from '@angular/core';

export type TicketStatus = 'Received' | 'Not Received';

export interface Doctor {
  id: number;
  name: string;
}

export interface Ticket {
  id: number;
  patient: string;
  phone: string;
  status: TicketStatus;
  timeSlot?: string;
}

export interface Clinic {
  id: number;
  name: string;
  doctors: Doctor[];
  schedule: Record<number, (Ticket | null)[]>;
}

export interface Slot {
  index: number;
  type: 'received' | 'notReceived' | 'empty';
  ticket?: Ticket | null;
  timeSlot?: string;
  css: 'received' | 'not-received' | 'empty';
  shortTime?: string;
  title: string;
}

export interface DayStats {
  reserved: number;
  notReceived: number;
  empty: number;
  available: number;
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class ScheduleServices {
  readonly TOTAL_SLOTS = 55;
  readonly SLOTS_PER_HOUR = 2;

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

  days = Array.from({ length: 31 }, (_, i) => i + 1);

  private timeSlots: string[] = [];

  schedules: Record<number, Record<number, Record<number, (Ticket | null)[]>>> = {};

  slotCache: Record<number, Record<number, Record<number, Slot[]>>> = {};

  dayStatsCache: Record<number, Record<number, Record<number, DayStats>>> = {};

  timeDistCache: Record<string, { time: string; count: number }[]> = {};

  selectedClinicId = signal<number | null>(null);
  selectedDoctor = signal<Doctor | null>(null);
  selectedDay = signal<number | null>(null);

  constructor() {
    this.timeSlots = this.generateTimeSlots();
  }

  // ================== Time Slots ==================

  private generateTimeSlots(): string[] {
    const out: string[] = [];
    const startHour = 8;
    const endHour = 20; // 8 AM -> 8 PM
    for (let h = startHour; h < endHour; h++) {
      for (let s = 0; s < this.SLOTS_PER_HOUR; s++) {
        const minutes = s === 0 ? '00' : '30';
        const period = h < 12 ? 'AM' : 'PM';
        const displayHour = h > 12 ? h - 12 : h;
        out.push(`${displayHour}:${minutes} ${period}`);
      }
    }
    return out;
  }

  // ================== Init / Build ==================

  ensureClinicBuilt(clinicId: number) {
    if (this.schedules[clinicId]) return;

    const clinic = this.clinics.find((c) => c.id === clinicId);
    if (!clinic) return;

    this.schedules[clinicId] = {};
    this.slotCache[clinicId] = {};
    this.dayStatsCache[clinicId] = {};

    for (const doc of clinic.doctors) {
      this.schedules[clinicId][doc.id] = {};
      this.slotCache[clinicId][doc.id] = {};
      this.dayStatsCache[clinicId][doc.id] = {};

      for (const day of this.days) {
        // dummy data for demo
        const arr: (Ticket | null)[] = new Array(this.TOTAL_SLOTS).fill(null);

        for (let idx = 0; idx < this.TOTAL_SLOTS && idx < this.timeSlots.length; idx++) {
          if (Math.random() < 0.55) {
            const received = Math.random() < 0.65;
            arr[idx] = {
              id: Number(`${day}${idx}`) + 1000,
              patient: `Patient ${idx + 1}`,
              phone: `05${Math.floor(10000000 + Math.random() * 89999999)}`,
              status: received ? 'Received' : 'Not Received',
              timeSlot: this.timeSlots[idx],
            };
          }
        }

        this.schedules[clinicId][doc.id][day] = arr;
        this.slotCache[clinicId][doc.id][day] = this.buildSlotsFromTickets(arr);
        this.updateDayStats(clinicId, doc.id, day);
        this.updateTimeDistCache(clinicId, doc.id, day);
      }
    }
  }

  // ================== Build helpers ==================

  private buildSlotsFromTickets(arr: (Ticket | null)[]): Slot[] {
    return arr.map((tk, index) => {
      const timeSlot = index < this.timeSlots.length ? this.timeSlots[index] : 'Extra Slot';

      if (!tk) {
        return {
          index,
          type: 'empty',
          css: 'empty',
          timeSlot,
          shortTime: timeSlot.split(' ')[0],
          title: `Empty - ${timeSlot}`,
          ticket: null,
        };
      }

      const type: Slot['type'] = tk.status === 'Received' ? 'received' : 'notReceived';

      return {
        index,
        type,
        css: type === 'received' ? 'received' : 'not-received',
        ticket: tk,
        timeSlot: tk.timeSlot ?? timeSlot,
        shortTime: (tk.timeSlot ?? timeSlot).split(' ')[0],
        title: tk.timeSlot ?? timeSlot,
      };
    });
  }

  private updateDayStats(clinicId: number, doctorId: number, day: number) {
    const slots = this.slotCache[clinicId]?.[doctorId]?.[day] ?? [];
    let reserved = 0;
    let notReceived = 0;
    let empty = 0;

    for (const s of slots) {
      if (s.type === 'received') reserved++;
      else if (s.type === 'notReceived') notReceived++;
      else empty++;
    }

    const available = notReceived + empty;

    if (!this.dayStatsCache[clinicId]) {
      this.dayStatsCache[clinicId] = {};
    }
    if (!this.dayStatsCache[clinicId][doctorId]) {
      this.dayStatsCache[clinicId][doctorId] = {};
    }

    this.dayStatsCache[clinicId][doctorId][day] = {
      reserved,
      notReceived,
      empty,
      available,
      total: slots.length,
    };
  }

  private updateTimeDistCache(clinicId: number, doctorId: number, day: number) {
    const key = `${clinicId}-${doctorId}-${day}`;
    const slots = this.slotCache[clinicId]?.[doctorId]?.[day] ?? [];
    const map = new Map<string, number>();

    for (const s of slots) {
      if (s.timeSlot) {
        map.set(s.timeSlot, (map.get(s.timeSlot) ?? 0) + 1);
      }
    }

    this.timeDistCache[key] = Array.from(map.entries()).map(([time, count]) => ({ time, count }));
  }

  // ================== Public APIs ==================

  slots(clinicId: number, doctorId: number, day: number): Slot[] {
    return this.slotCache[clinicId]?.[doctorId]?.[day] ?? [];
  }

  /** precomputed stats: تستخدم في الجدول بدل حساب متكرر */
  countsFor(clinicId: number, doctorId: number, day: number): DayStats {
    const byClinic = this.dayStatsCache[clinicId];
    const byDoctor = byClinic?.[doctorId];
    const stats = byDoctor?.[day];

    if (stats) return stats;

    // fallback أمان في حالة عدم وجود كاش (ما يحصلش غالباً)
    const slots = this.slots(clinicId, doctorId, day);
    let reserved = 0;
    let notReceived = 0;
    let empty = 0;

    for (const s of slots) {
      if (s.type === 'received') reserved++;
      else if (s.type === 'notReceived') notReceived++;
      else empty++;
    }

    const available = notReceived + empty;

    return {
      reserved,
      notReceived,
      empty,
      available,
      total: slots.length,
    };
  }

  timeDistribution(clinicId: number, doctorId: number, day: number) {
    return this.timeDistCache[`${clinicId}-${doctorId}-${day}`] ?? [];
  }

  // ================== Mutations ==================

  addAtSlot(clinicId: number, doctorId: number, day: number, slotIndex: number, t: Ticket) {
    if (!this.schedules[clinicId]?.[doctorId]?.[day]) {
      if (!this.schedules[clinicId]) this.schedules[clinicId] = {};
      if (!this.schedules[clinicId][doctorId]) this.schedules[clinicId][doctorId] = {};
      this.schedules[clinicId][doctorId][day] = new Array(this.TOTAL_SLOTS).fill(null);
    }

    this.schedules[clinicId][doctorId][day][slotIndex] = t;
    this.refreshDay(clinicId, doctorId, day);
  }

  updateTicket(clinicId: number, doctorId: number, day: number, ticket: Ticket) {
    const arr = this.schedules[clinicId]?.[doctorId]?.[day] ?? [];
    const idx = arr.findIndex((t) => t?.id === ticket.id);
    if (idx !== -1) {
      arr[idx] = { ...ticket };
      this.refreshDay(clinicId, doctorId, day);
    }
  }

  refreshDay(clinicId: number, doctorId: number, day: number) {
    const tickets = this.schedules[clinicId]?.[doctorId]?.[day] ?? [];
    if (!this.slotCache[clinicId]) this.slotCache[clinicId] = {};
    if (!this.slotCache[clinicId][doctorId]) this.slotCache[clinicId][doctorId] = {};

    this.slotCache[clinicId][doctorId][day] = this.buildSlotsFromTickets(tickets);

    this.updateDayStats(clinicId, doctorId, day);
    this.updateTimeDistCache(clinicId, doctorId, day);
  }

  // ================== Helpers ==================

  getTimeSlotLabel(index: number) {
    return index < this.timeSlots.length ? this.timeSlots[index] : 'Extra Slot';
  }

  receivedSlots(clinicId: number, doctorId: number, day: number) {
    return this.slots(clinicId, doctorId, day).filter((s) => s.type === 'received');
  }

  notReceivedSlots(clinicId: number, doctorId: number, day: number) {
    return this.slots(clinicId, doctorId, day).filter((s) => s.type === 'notReceived');
  }

  emptySlots(clinicId: number, doctorId: number, day: number) {
    return this.slots(clinicId, doctorId, day).filter((s) => s.type === 'empty');
  }

  getTicketById(clinicId: number, doctorId: number, day: number, ticketId: number): Ticket | null {
    const arr = this.schedules[clinicId]?.[doctorId]?.[day] ?? [];
    return (arr.find((t) => t?.id === ticketId) as Ticket) ?? null;
  }
}
