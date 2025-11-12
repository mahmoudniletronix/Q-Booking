import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environment/environment';
import { Subject } from 'rxjs';

export type TicketStatus = 'Received' | 'Not Received';

export interface Ticket {
  id: number;
  patient: string;
  phone: string;
  status: TicketStatus;
  timeSlot?: string;
}

export interface Doctor {
  id: number;
  name: string;
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

export interface Clinic {
  id: number;
  name: string;
  doctors: Doctor[];
}

export interface Slot {
  index: number;
  timeSlot: string;
  type: 'received' | 'notReceived' | 'empty';
  ticket?: Ticket | null;
}

interface ScheduleApiItem {
  serviceId: number;
  serviceName: string;
  day: string;
  reservedCount: number;
  capacity: number;
  available: number;
  waitingDurationMinutes?: number;
  shifts?: { startFrom: string; finishBy: string }[];
  firstStart?: string;
  lastFinish?: string;
}

export interface DayMeta {
  waitingDurationMinutes: number;
  firstStart: string;
  lastFinish: string;
  shifts: { startFrom: string; finishBy: string }[];
}

@Injectable({ providedIn: 'root' })
export class ScheduleServices {
  selectedBranchId = signal<number | null>(null);
  selectedClinicId = signal<number | null>(null);
  selectedDoctorId = signal<number | null>(null);

  setSelectedDoctor(id: number | null) {
    this.selectedDoctorId.set(id);
  }

  private readonly _branches = signal<Branch[]>([]);
  private readonly _branchesLoading = signal<boolean>(false);
  branches = this._branches;
  branchesLoading = this._branchesLoading;

  clinics: Clinic[] = [];

  private countsCache: Record<number, Record<number, Record<string, DayStats>>> = {};
  private metaCache: Record<number, Record<number, Record<string, DayMeta>>> = {};

  readonly scheduleChanged$ = new Subject<{ clinicId: number; year: number; month: number }>();

  private readonly dayNamesEn = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  private readonly dayNamesAr = [
    'الأحد',
    'الإثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة',
    'السبت',
  ];
  private readonly _clinicsLoading = signal<boolean>(false);
  clinicsLoading = this._clinicsLoading;
  constructor(private http: HttpClient) {
    this.loadBranches();
  }

  private loadSpecializationsByBranch(branchId: number): void {
    if (!branchId) {
      this.clinics = [];
      return;
    }

    this._clinicsLoading.set(true);
    const url = `${environment.baseUrl}/specialized?branchId=${branchId}`;

    this.http.get<{ item?: any[]; items?: any[] }>(url).subscribe({
      next: (res) => {
        const list = res?.item ?? res?.items ?? [];
        this.clinics = list.map((sp: any) => ({
          id: sp.id,
          name: sp.arabicName || sp.englishName || `Clinic ${sp.id}`,
          doctors: [],
        }));
        this._clinicsLoading.set(false);
      },
      error: () => {
        this.clinics = [];
        this._clinicsLoading.set(false);
      },
    });
  }

  setSelectedBranch(id: number | null) {
    this.selectedBranchId.set(id);

    this.setSelectedClinic(null);
    this.clinics = [];
    this.countsCache = {};
    this.metaCache = {};

    if (id) {
      this.loadSpecializationsByBranch(id);
    }
  }

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
      error: () => {
        this._branches.set([]);
        this._branchesLoading.set(false);
      },
    });
  }

  private loadSpecializations(): void {
    this.http.get<{ item: any[] }>(`${environment.baseUrl}/specialized`).subscribe({
      next: (res) => {
        const items = res?.item || [];
        this.clinics = items.map((sp: any) => ({
          id: sp.id,
          name: sp.arabicName || sp.englishName || `Clinic ${sp.id}`,
          doctors: [],
        }));
      },
      error: () => {
        this.clinics = [];
      },
    });
  }

  setSelectedClinic(id: number | null) {
    this.selectedClinicId.set(id);
  }

  loadSchedule(clinicId: number, year: number, month: number, searchTerm?: string): void {
    if (!clinicId || !year || !month) return;

    let url = `${environment.baseUrl}/ticket-reservation/get-schedule?serviceid=${clinicId}&year=${year}&month=${month}`;
    const trimmed = (searchTerm ?? '').trim();
    if (trimmed) url += `&searchTerm=${encodeURIComponent(trimmed)}`;
    url += `&ts=${Date.now()}`;

    this.http.get<{ item: ScheduleApiItem[] }>(url).subscribe({
      next: (res) => {
        const items = res?.item || [];
        const clinic = this.clinics.find((c) => c.id === clinicId);
        if (!clinic) return;

        const doctorMap: Record<number, Doctor> = {};
        const clinicCounts: Record<number, Record<string, DayStats>> = {};
        const clinicMeta: Record<number, Record<string, DayMeta>> = {};

        for (const row of items) {
          const capacity = row.capacity ?? 0;
          if (capacity <= 0) continue;

          const doctorId = row.serviceId;
          const doctorName = row.serviceName || `Doctor ${doctorId}`;
          const dayKey = this.normalizeDateKey(row.day);
          if (!dayKey) continue;

          if (!doctorMap[doctorId]) doctorMap[doctorId] = { id: doctorId, name: doctorName };
          if (!clinicCounts[doctorId]) clinicCounts[doctorId] = {};
          if (!clinicMeta[doctorId]) clinicMeta[doctorId] = {};

          let stats = clinicCounts[doctorId][dayKey];
          if (!stats) {
            stats = { reserved: 0, notReceived: 0, empty: 0, available: 0, total: 0 };
            clinicCounts[doctorId][dayKey] = stats;
          }

          const reserved = row.reservedCount ?? 0;
          const available = row.available ?? 0;

          stats.reserved += reserved;
          stats.available += available;
          stats.total += capacity;
          stats.empty = stats.available;

          clinicMeta[doctorId][dayKey] = {
            waitingDurationMinutes: row.waitingDurationMinutes ?? 30,
            firstStart: row.firstStart || (row.shifts?.[0]?.startFrom ?? '00:00:00'),
            lastFinish:
              row.lastFinish || (row.shifts?.[row.shifts.length - 1]?.finishBy ?? '23:59:59'),
            shifts: row.shifts || [],
          };
        }

        clinic.doctors = Object.values(doctorMap).sort((a, b) =>
          a.name.localeCompare(b.name, 'ar')
        );
        this.countsCache[clinicId] = clinicCounts;
        this.metaCache[clinicId] = clinicMeta;

        this.scheduleChanged$.next({ clinicId, year, month });
      },
      error: () => {
        this.countsCache[clinicId] = {};
        this.metaCache[clinicId] = {};
        this.scheduleChanged$.next({ clinicId, year, month });
      },
    });
  }

  getDoctorsByClinic(clinicId: number): Doctor[] {
    const clinic = this.clinics.find((c) => c.id === clinicId);
    return clinic?.doctors || [];
  }

  hasSchedule(clinicId: number): boolean {
    return !!this.countsCache[clinicId];
  }

  countsFor(clinicId: number, doctorId: number, date: Date): DayStats {
    const dayKey = this.toDayKey(date);
    const clinicMap = this.countsCache[clinicId];
    const doctorMap = clinicMap?.[doctorId];
    const base = doctorMap?.[dayKey];
    if (!base) return { reserved: 0, notReceived: 0, empty: 0, available: 0, total: 0 };
    return {
      reserved: base.reserved,
      notReceived: base.notReceived,
      empty: base.available,
      available: base.available,
      total: base.total,
    };
  }

  getDayMeta(clinicId: number, doctorId: number, day: string | Date): DayMeta | null {
    const dayKey = this.toDayKey(this.toDate(day));
    return this.metaCache[clinicId]?.[doctorId]?.[dayKey] ?? null;
  }

  // ===== Helpers =====
  getDayNameFor(
    _c: number,
    _d: number,
    day: string | number | Date,
    lang: 'en' | 'ar' = 'en'
  ): string {
    const d = this.toDate(day);
    const idx = d.getDay();
    const dict = lang === 'ar' ? this.dayNamesAr : this.dayNamesEn;
    return dict[idx] || '';
  }

  private normalizeDateKey(raw: string): string | null {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return this.toDayKey(d);
  }

  private toDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toDate(day: string | number | Date): Date {
    if (day instanceof Date) return day;
    if (typeof day === 'number') {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), day);
    }
    const d = new Date(day);
    if (!isNaN(d.getTime())) return d;
    return new Date();
  }
}
