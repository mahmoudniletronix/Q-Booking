import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environment/environment';
import { forkJoin } from 'rxjs';

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

export interface Branch {
  id: number;
  name: string;
  arabicName: string;
  englishName: string;
  ipAddress: string;
  isUpdatesAvailable: boolean;
  lastUpdated: string;
  path: string;
}

interface OperatorDetail {
  operatorId: number;
  name: string;
  durationWaiting: number;
  reservedTickets: number;
  availableTickets: number;
  weekDays: string[];
  startTime: string;
  endTime: string;
}

@Injectable({ providedIn: 'root' })
export class ScheduleServices {
  private readonly dayNamesEn: Record<string, string> = {
    su: 'Sunday',
    mo: 'Monday',
    tu: 'Tuesday',
    we: 'Wednesday',
    th: 'Thursday',
    fr: 'Friday',
    sa: 'Saturday',
  };

  private readonly dayNamesAr: Record<string, string> = {
    su: 'الأحد',
    mo: 'الإثنين',
    tu: 'الثلاثاء',
    we: 'الأربعاء',
    th: 'الخميس',
    fr: 'الجمعة',
    sa: 'السبت',
  };

  getDayNameFor(
    clinicId: number,
    doctorId: number,
    day: string | number | Date,
    lang: 'en' | 'ar' = 'en'
  ): string {
    const details = this.operatorDetailsByClinic[clinicId] || [];

    let date: Date;
    if (day instanceof Date) {
      date = day;
    } else if (typeof day === 'string') {
      date = new Date(day);
    } else {
      const now = new Date();
      date = new Date(now.getFullYear(), now.getMonth(), day);
    }

    const dayCode = this.getDayCode(date);

    const match = details.find((d) => d.operatorId === doctorId && d.weekDays.includes(dayCode));

    const dict = lang === 'ar' ? this.dayNamesAr : this.dayNamesEn;

    if (match && dict[dayCode]) return dict[dayCode];

    return dict[dayCode] || '';
  }

  // ===== Branches =====
  private readonly _branches = signal<Branch[]>([]);
  private readonly _branchesLoading = signal<boolean>(false);

  branches = this._branches;
  branchesLoading = this._branchesLoading;

  // ===== Specializations =====
  clinics: Clinic[] = [];

  // Operators + details cache
  private operatorsByClinic: Record<number, Doctor[]> = {};
  private operatorDetailsByClinic: Record<number, OperatorDetail[]> = {};

  // Selected
  selectedClinicId = signal<number | null>(null);
  selectedDoctor = signal<Doctor | null>(null);

  constructor(private http: HttpClient) {
    this.loadBranches();
    this.loadSpecializations();
  }

  // ================== Branches ==================

  private loadBranches(): void {
    this._branchesLoading.set(true);

    this.http.get<{ items: any[] }>(`${environment.baseUrl}/branches`).subscribe({
      next: (res) => {
        const items = res?.items || [];

        const mapped: Branch[] = items.map((item) => {
          const slug =
            (item.englishName || '')
              .toString()
              .trim()
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9\-]/g, '') || `branch-${item.id}`;

          return {
            id: item.id,
            name: item.arabicName || item.englishName,
            arabicName: item.arabicName,
            englishName: item.englishName,
            ipAddress: item.ipAddress,
            isUpdatesAvailable: item.isUpdatesAvailable,
            lastUpdated: item.lastUpdated,
            path: `/branches/${slug}`,
          };
        });

        this._branches.set(mapped);
        this._branchesLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load branches', err);
        this._branches.set([]);
        this._branchesLoading.set(false);
      },
    });
  }

  // ================== Specializations ==================

  private loadSpecializations(): void {
    this.http.get<{ item: any[] }>(`${environment.baseUrl}/specialized`).subscribe({
      next: (res) => {
        const items = res?.item || [];

        this.clinics = items.map((sp: any) => {
          const name = sp.arabicName || sp.englishName || `Clinic ${sp.id}`;
          return {
            id: sp.id,
            name,
            doctors: [],
            schedule: {},
          } as Clinic;
        });
      },
      error: (err) => {
        console.error('Failed to load specializations', err);
        this.clinics = [];
      },
    });
  }

  loadOperatorsForClinic(clinicId: number): void {
    if (!clinicId) return;

    // /get-operators{id}
    const url = `${environment.baseUrl}/specialized/get-operators${clinicId}`;
    console.log('GET operators:', url);

    this.http.get<{ item: any[] }>(url).subscribe({
      next: (res) => {
        const items = res?.item || [];

        const operators: Doctor[] = items.map((op: any) => ({
          id: op.id,
          name: op.arabicName || op.englishName,
        }));

        console.log('operators for clinic', clinicId, operators);

        this.operatorsByClinic[clinicId] = operators;

        const clinic = this.clinics.find((c) => c.id === clinicId);
        if (clinic) clinic.doctors = operators;

        this.loadOperatorDetailsForClinic(clinicId, operators);
      },
      error: (err) => {
        console.error(`Failed to load operators for clinic ${clinicId}`, err);
        this.operatorsByClinic[clinicId] = [];
        const clinic = this.clinics.find((c) => c.id === clinicId);
        if (clinic) clinic.doctors = [];
        this.operatorDetailsByClinic[clinicId] = [];
      },
    });
  }

  getDoctorsByClinic(clinicId: number): Doctor[] {
    const clinic = this.clinics.find((c) => c.id === clinicId);
    return clinic?.doctors || this.operatorsByClinic[clinicId] || [];
  }

  hasOperatorDetails(clinicId: number): boolean {
    return (this.operatorDetailsByClinic[clinicId] || []).length > 0;
  }

  private loadOperatorDetailsForClinic(clinicId: number, operators: Doctor[]): void {
    if (!clinicId || !operators.length) {
      this.operatorDetailsByClinic[clinicId] = [];
      return;
    }

    const requests = operators.map((op) =>
      this.http.get<{ item: any[] }>(
        `${environment.baseUrl}/specialized/get-operator-details${op.id}`
      )
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        const allDetails: OperatorDetail[] = [];

        responses.forEach((res, index) => {
          const op = operators[index];
          const items = res?.item || [];

          items.forEach((it: any) => {
            allDetails.push({
              operatorId: op.id,
              name: it.arabicName || it.englishName || op.name,
              durationWaiting: it.durationWaiting,
              reservedTickets: it.reservedTickets ?? 0,
              availableTickets: it.availableTickets ?? 0,
              weekDays: this.extractWeekDays(it.weekDay),
              startTime: it.startTime,
              endTime: it.endTime,
            });
          });
        });

        console.log('details for clinic', clinicId, allDetails);
        this.operatorDetailsByClinic[clinicId] = allDetails;
      },
      error: (err) => {
        console.error(`Failed to load operator details for clinic ${clinicId}`, err);
        this.operatorDetailsByClinic[clinicId] = [];
      },
    });
  }

  private extractWeekDays(raw: string): string[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((v) => !!v);
  }

  private getDayCode(date: Date): string {
    const codes = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
    return codes[date.getDay()];
  }

  countsFor(clinicId: number, doctorId: number, date: Date): DayStats {
    const details = this.operatorDetailsByClinic[clinicId] || [];
    const currentCode = this.getDayCode(date);

    const matches = details.filter(
      (d) => d.operatorId === doctorId && d.weekDays.includes(currentCode)
    );

    if (!matches.length) {
      return {
        reserved: 0,
        notReceived: 0,
        empty: 0,
        available: 0,
        total: 0,
      };
    }

    const reserved = matches.reduce((sum, d) => sum + (d.reservedTickets || 0), 0);
    const available = matches.reduce((sum, d) => sum + (d.availableTickets || 0), 0);
    const total = reserved + available;

    return {
      reserved,
      notReceived: 0,
      empty: available,
      available,
      total,
    };
  }

  slots(clinicId: number, doctorId: number, day: string | number | Date): Slot[] {
    const details = this.operatorDetailsByClinic[clinicId] || [];
    if (!details.length) return [];

    let date: Date;

    if (day instanceof Date) {
      date = day;
    } else if (typeof day === 'string') {
      date = new Date(day);
    } else {
      const now = new Date();
      date = new Date(now.getFullYear(), now.getMonth(), day);
    }

    const dayCode = this.getDayCode(date);

    const matches = details.filter(
      (d) => d.operatorId === doctorId && d.weekDays.includes(dayCode)
    );

    if (!matches.length) return [];

    let all: Slot[] = [];
    let startIndex = 0;

    for (const det of matches) {
      const part = this.buildSlotsFromDetail(det, startIndex);
      all = all.concat(part);
      startIndex += part.length;
    }

    return all;
  }

  private buildSlotsFromDetail(detail: OperatorDetail, startIndex = 0): Slot[] {
    const slots: Slot[] = [];

    const SLOT_MINUTES = 30;

    const [sh, sm] = detail.startTime.split(':').map(Number);
    const [eh, em] = detail.endTime.split(':').map(Number);

    let current = sh * 60 + sm;
    const end = eh * 60 + em;

    const maxByTime = Math.floor((end - current) / SLOT_MINUTES);
    const totalSlots = Math.min(detail.availableTickets || 0, Math.max(maxByTime, 0));

    for (let i = 0; i < totalSlots; i++) {
      const minutes = current + i * SLOT_MINUTES;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      slots.push({
        index: startIndex + i,
        type: 'empty',
        css: 'empty',
        ticket: null,
        timeSlot: label,
        shortTime: label,
        title: `Available slot ${startIndex + i + 1} (${label})`,
      });
    }

    return slots;
  }

  addAtSlot(
    _clinicId: number,
    _doctorId: number,
    _day: number | string,
    _slotIndex: number,
    _t: Ticket
  ) {}
  updateTicket(_clinicId: number, _doctorId: number, _day: number | string, _ticket: Ticket) {}
  refreshDay(_clinicId: number, _doctorId: number, _day: number | string) {}
  getTimeSlotLabel(_index: number) {
    return '';
  }
  receivedSlots(_clinicId: number, _doctorId: number, _day: number | string) {
    return [];
  }
  notReceivedSlots(_clinicId: number, _doctorId: number, _day: number | string) {
    return [];
  }
  emptySlots(_clinicId: number, _doctorId: number, _day: number | string) {
    return [];
  }
  getTicketById(
    _clinicId: number,
    _doctorId: number,
    _day: number | string,
    _ticketId: number
  ): Ticket | null {
    return null;
  }
}
