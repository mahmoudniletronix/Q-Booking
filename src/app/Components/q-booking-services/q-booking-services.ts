import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  Branch,
  DayStats,
  Doctor,
  ScheduleServices,
} from '../../service/schedule/schedule-services';
import { HeaderPathService } from '../../service/HeaderPathService/HeaderPath-Service';

type OperatorId = 'all' | number;

interface VisibleDay {
  dayNum: number;
  label: string;
  date: Date;
}

@Component({
  selector: 'app-q-booking-services',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './q-booking-services.html',
  styleUrls: ['./q-booking-services.css'],
  // لاحظ: مفيش OnPush هنا
})
export class QBookingServices {
  private headerPath = inject(HeaderPathService);

  constructor(public sch: ScheduleServices, private router: Router) {
    this.buildVisibleDays();
  }

  selectedBranchId: number | null = null;
  selectedBranchPath = '';

  filter = {
    searchQuery: '',
    operatorId: 'all' as OperatorId,
  };

  private readonly today = new Date();
  viewYear = this.today.getFullYear();
  viewMonth = this.today.getMonth(); // 0-based

  visibleDays: VisibleDay[] = [];

  // ===== Keyboard nav for month =====
  @HostListener('window:keydown', ['$event'])
  handleMonthKeyboardNav(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const tag = (target.tagName || '').toLowerCase();
    const isTextInput =
      tag === 'input' ||
      tag === 'textarea' ||
      target.isContentEditable ||
      target.getAttribute('role') === 'textbox';

    if (isTextInput) return;

    if (event.key === 'ArrowRight') this.nextMonth();
    else if (event.key === 'ArrowLeft') this.prevMonth();
  }

  // ===== Branches =====
  get branches(): Branch[] {
    return this.sch.branches();
  }

  onBranchChange(id: number | null) {
    this.selectedBranchId = id;
    this.sch.setSelectedBranch(id);

    const br = this.branches.find((b) => b.id === id) || null;
    this.selectedBranchPath = br ? br.path : '';

    this.headerPath.setBranchPath(this.selectedBranchPath);
    this.updateHeaderPath();
  }

  // ===== Specialization =====
  onSpecializationChange(id: number | null) {
    this.sch.setSelectedClinic(id);
    this.resetFilters();
    this.updateHeaderPath();

    if (id) {
      this.loadScheduleForCurrentMonth();
    }
  }

  private updateHeaderPath() {
    const clinicName = this.selectedClinicName;
    const extra =
      clinicName && clinicName !== 'Select a specialization' ? `Main / ${clinicName}` : 'Main';
    this.headerPath.setExtraPath(extra);
  }

  private loadScheduleForCurrentMonth() {
    const clinicId = this.sch.selectedClinicId();
    if (!clinicId) return;
    this.sch.loadSchedule(clinicId, this.viewYear, this.viewMonth + 1);
  }

  // ===== Filters =====
  get hasActiveFilters(): boolean {
    return (
      (this.filter.searchQuery && this.filter.searchQuery.trim().length > 0) ||
      this.filter.operatorId !== 'all'
    );
  }

  resetFilters() {
    this.filter = {
      searchQuery: '',
      operatorId: 'all',
    };
  }

  onOperatorChange(id: OperatorId) {
    this.filter.operatorId = id;
  }

  // ===== Selected clinic / doctors =====
  get selectedClinic() {
    const id = this.sch.selectedClinicId();
    return id ? this.sch.clinics.find((c) => c.id === id) ?? null : null;
  }

  get selectedClinicName(): string {
    return this.selectedClinic?.name ?? 'Select a specialization';
  }

  private get selectedClinicDoctorsInternal(): Doctor[] {
    const id = this.sch.selectedClinicId();
    return id ? this.sch.getDoctorsByClinic(id) : [];
  }

  get filteredClinicDoctors(): Doctor[] {
    const docs = this.selectedClinicDoctorsInternal;
    const q = this.filter.searchQuery.trim().toLowerCase();

    return docs.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (this.filter.operatorId !== 'all' && this.filter.operatorId !== d.id) return false;
      return true;
    });
  }

  // ===== Month / days =====
  get monthLabel(): string {
    const date = new Date(this.viewYear, this.viewMonth, 1);
    return date.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  private get startDayForView(): number {
    if (this.viewYear === this.today.getFullYear() && this.viewMonth === this.today.getMonth()) {
      return this.today.getDate();
    }
    return 1;
  }

  private buildVisibleDays() {
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const start = this.startDayForView;
    const result: VisibleDay[] = [];

    for (let d = start; d <= daysInMonth; d++) {
      const date = new Date(this.viewYear, this.viewMonth, d);

      const label = date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });

      result.push({ dayNum: d, label, date });
    }

    this.visibleDays = result;
  }

  prevMonth() {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
    } else {
      this.viewMonth -= 1;
    }
    this.buildVisibleDays();
    this.loadScheduleForCurrentMonth();
  }

  nextMonth() {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
    } else {
      this.viewMonth += 1;
    }
    this.buildVisibleDays();
    this.loadScheduleForCurrentMonth();
  }

  // ===== DayStats =====
  counts(clinicId: number, doctorId: number, day: VisibleDay): DayStats {
    return this.sch.countsFor(clinicId, doctorId, day.date);
  }

  // ===== Navigation on click =====
  private formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onReservedClick(clinicId: number, doctor: Doctor, day: VisibleDay) {
    if (!clinicId || !doctor?.id) return;
    const dayKey = this.formatDateKey(day.date);
    this.router.navigate(['/patient/received', clinicId, doctor.id, dayKey]);
  }

  onAvailableClick(clinicId: number, doctor: Doctor, day: VisibleDay) {
    if (!clinicId || !doctor?.id) return;
    const dayKey = this.formatDateKey(day.date);
    this.router.navigate(['/patient/available', clinicId, doctor.id, dayKey]);
  }

  // ===== trackBy =====
  trackByDay = (_: number, day: VisibleDay) => day.dayNum;
  trackByDoctor = (_: number, d: Doctor) => d.id;
}
