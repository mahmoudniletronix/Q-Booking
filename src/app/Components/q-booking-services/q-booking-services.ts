import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  Doctor,
  ScheduleServices,
  Slot,
  Branch,
  DayStats,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QBookingServices {
  private headerPath = inject(HeaderPathService);

  constructor(public sch: ScheduleServices, private router: Router) {}

  selectedBranchId: number | null = null;
  selectedBranchPath = '';

  filter = {
    searchQuery: '',
    operatorId: 'all' as OperatorId,
    reservedChecked: true,
    availableChecked: true,
  };

  private readonly today = new Date();
  viewYear = this.today.getFullYear();
  viewMonth = this.today.getMonth();

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

    const br = this.branches.find((b) => b.id === id) || null;
    this.selectedBranchPath = br ? br.path : '';

    this.headerPath.setBranchPath(this.selectedBranchPath);
    this.updateHeaderPath();
  }

  // ===== Specialization =====
  onSpecializationChange(id: number | null) {
    this.sch.selectedClinicId.set(id);
    this.resetFilters();
    this.updateHeaderPath();
    if (id) this.sch.loadOperatorsForClinic(id);
  }

  private updateHeaderPath() {
    const clinicName = this.selectedClinicName;
    const extra =
      clinicName && clinicName !== 'Select a specialization' ? `Main / ${clinicName}` : 'Main';
    this.headerPath.setExtraPath(extra);
  }

  // ===== Filters =====
  get hasActiveFilters(): boolean {
    return (
      (this.filter.searchQuery && this.filter.searchQuery.trim().length > 0) ||
      this.filter.operatorId !== 'all' ||
      !(this.filter.reservedChecked && this.filter.availableChecked)
    );
  }

  resetFilters() {
    this.filter = {
      searchQuery: '',
      operatorId: 'all',
      reservedChecked: true,
      availableChecked: true,
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

  get selectedClinicDoctors(): Doctor[] {
    const id = this.sch.selectedClinicId();
    return id ? this.sch.getDoctorsByClinic(id) : [];
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

  get visibleDays(): VisibleDay[] {
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

    return result;
  }

  prevMonth() {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
    } else {
      this.viewMonth -= 1;
    }
  }

  nextMonth() {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
    } else {
      this.viewMonth += 1;
    }
  }

  // ===== Filtered doctors =====
  get filteredClinicDoctors(): Doctor[] {
    const docs = this.selectedClinicDoctors;
    const clinicId = this.sch.selectedClinicId();
    if (!docs || !clinicId) return [];

    const q = this.filter.searchQuery.trim().toLowerCase();
    const hasDetails = this.sch.hasOperatorDetails(clinicId);

    return docs.filter((d) => {
      if (q) {
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesStatus =
          q.includes('reserved') ||
          q.includes('حجز') ||
          q.includes('available') ||
          q.includes('متاح');
        const matchesDay = this.visibleDays.some((day) => day.label.toLowerCase().includes(q));

        if (!matchesName && !matchesStatus && !matchesDay) return false;
      }

      if (this.filter.operatorId !== 'all' && this.filter.operatorId !== d.id) {
        return false;
      }

      if (!hasDetails) return true;

      if (this.filter.reservedChecked || this.filter.availableChecked) {
        const hasReserved =
          this.filter.reservedChecked && this.hasStatusForDoctor(clinicId, d.id, 'reserved');
        const hasAvailable =
          this.filter.availableChecked && this.hasStatusForDoctor(clinicId, d.id, 'available');

        if (!hasReserved && !hasAvailable) return false;
      }

      return true;
    });
  }

  private hasStatusForDoctor(
    clinicId: number,
    doctorId: number,
    status: 'reserved' | 'available'
  ): boolean {
    for (const day of this.visibleDays) {
      const c = this.counts(clinicId, doctorId, day);
      if (status === 'reserved' && c.reserved > 0) return true;
      if (status === 'available' && c.available > 0) return true;
    }
    return false;
  }

  counts(clinicId: number, doctorId: number, day: VisibleDay): DayStats {
    return this.sch.countsFor(clinicId, doctorId, day.date);
  }

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

  ui = {
    showEmptyPicker: false,
    showReceivedList: false,
    clinicId: null as number | null,
    doctor: null as Doctor | null,
    day: null as number | null,
  };

  emptySlots: Slot[] = [];
  receivedSlots: Slot[] = [];

  openEmptyPicker(clinicId: number, doctor: Doctor, day: number) {
    const all = this.sch.slots(clinicId, doctor.id, day);
    this.emptySlots = all.filter((s) => s.type === 'empty');
    this.ui = {
      showEmptyPicker: true,
      showReceivedList: false,
      clinicId,
      doctor,
      day,
    };
  }

  openReceivedList(clinicId: number, doctor: Doctor, day: number) {
    const all = this.sch.slots(clinicId, doctor.id, day);
    this.receivedSlots = all.filter((s) => s.ticket && s.ticket.status === 'Received');
    this.ui = {
      showEmptyPicker: false,
      showReceivedList: true,
      clinicId,
      doctor,
      day,
    };
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

  trackByDay = (_: number, day: VisibleDay) => day.dayNum;
  trackByDoctor = (_: number, d: Doctor) => d.id;
  trackBySlot = (_: number, s: Slot) => s.index;
}
