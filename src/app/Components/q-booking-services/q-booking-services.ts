import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Doctor, ScheduleServices, Slot } from '../../service/schedule/schedule-services';
import { HeaderPathService } from '../../service/HeaderPathService/HeaderPath-Service';

interface Branch {
  id: number;
  name: string;
  path: string;
}

type OperatorId = 'all' | number;

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
  private headerPath = inject(HeaderPathService);

  // ===== Branches =====
  branches: Branch[] = [
    {
      id: 1,
      name: 'CHG \\ El-Kateb Hospital',
      path: '/chg/el-kateb-hospital',
    },
    {
      id: 2,
      name: 'CHG \\ El-Something Branch',
      path: '/chg/el-something-branch',
    },
  ];

  selectedBranchId: number | null = null;
  selectedBranchPath = '';

  // ===== Filters State =====
  filter = {
    searchQuery: '', // Global search: doctors, days, status
    operatorId: 'all' as OperatorId,
    reservedChecked: true,
    availableChecked: true,
  };

  // ===== Month View State =====
  private readonly today = new Date();
  viewYear = this.today.getFullYear();
  viewMonth = this.today.getMonth();

  ngOnInit(): void {}

  // ==== Branch change ====
  onBranchChange(id: number | null) {
    this.selectedBranchId = id;
    const br = this.branches.find((b) => b.id === id) || null;
    this.selectedBranchPath = br ? br.path : '';
    this.headerPath.setBranchPath(this.selectedBranchPath);
    this.updateHeaderPath();
  }

  onSpecializationChange(id: number | null) {
    this.sch.selectedClinicId.set(id);
    if (id) this.sch.ensureClinicBuilt(id);
    this.resetFilters();
    this.updateHeaderPath();
  }

  private updateHeaderPath() {
    const clinicName = this.selectedClinicName;
    const extra =
      clinicName && clinicName !== 'Select a specialization' ? `Main / ${clinicName}` : 'Main';
    this.headerPath.setExtraPath(extra);
  }

  // ===== Filters helpers =====
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

  // ===== Selected clinic helpers =====
  get selectedClinic() {
    const id = this.sch.selectedClinicId();
    return id ? this.sch.clinics.find((c) => c.id === id) ?? null : null;
  }

  get selectedClinicName(): string {
    return this.selectedClinic?.name ?? 'Select a specialization';
  }

  get selectedClinicDoctors(): Doctor[] {
    return this.selectedClinic?.doctors ?? [];
  }

  // ===== Month label & visible days (من أول اليوم الحالي لو نفس الشهر) =====
  get monthLabel(): string {
    const date = new Date(this.viewYear, this.viewMonth, 1);
    return date.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  private get startDayForView(): number {
    // لو الشهر المعروض هو الشهر الحالي: نبدأ من اليوم الحالي
    if (this.viewYear === this.today.getFullYear() && this.viewMonth === this.today.getMonth()) {
      return this.today.getDate();
    }
    // غير كده نبدأ من 1
    return 1;
  }

  get visibleDays(): number[] {
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const start = this.startDayForView;
    const result: number[] = [];
    for (let d = start; d <= daysInMonth; d++) {
      result.push(d);
    }
    return result;
  }

  // التنقل بين الشهور
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

  // ===== Filtered doctors (global search + operator + status checkboxes) =====
  get filteredClinicDoctors(): Doctor[] {
    const docs = this.selectedClinicDoctors;
    const clinicId = this.sch.selectedClinicId();
    if (!docs || docs.length === 0 || !clinicId) return [];

    const q = this.filter.searchQuery.trim().toLowerCase();

    return docs.filter((d) => {
      // Global search: doctor name, or any day number, or status
      if (q) {
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesDay = this.visibleDays.some((day) => day.toString().includes(q));
        const matchesStatus =
          q.includes('reserved') ||
          q.includes('حجز') ||
          q.includes('available') ||
          q.includes('متاح');

        if (!matchesName && !matchesDay && !matchesStatus) return false;
      }

      // operator filter
      if (this.filter.operatorId !== 'all' && this.filter.operatorId !== d.id) {
        return false;
      }

      // status filter (checkboxes)
      if (this.filter.reservedChecked || this.filter.availableChecked) {
        const hasReserved =
          this.filter.reservedChecked && this.hasStatusForDoctor(clinicId, d.id, 'reserved');

        const hasAvailable =
          this.filter.availableChecked && this.hasStatusForDoctor(clinicId, d.id, 'available');

        if (!hasReserved && !hasAvailable) {
          return false;
        }
      }

      // لو الاتنين unchecked → مفيش فلتر Status
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

  // ===== Stats (نفس اللوجيك القديم) =====
  counts(clinicId: number, doctorId: number, day: number) {
    const slots = this.sch.slots(clinicId, doctorId, day);
    let reserved = 0;
    let notReceived = 0;
    let empty = 0;

    for (const s of slots) {
      if (s.type === 'empty') {
        empty++;
      } else if (s.ticket?.status === 'Received') {
        reserved++;
      } else {
        notReceived++;
      }
    }

    const available = notReceived + empty;
    return { reserved, available, total: slots.length };
  }

  // ===== Overlay helpers (محتفظين بيها لو احتجتها) =====
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

  // ===== TrackBy =====
  trackByDay = (_: number, day: number) => day;
  trackByDoctor = (_: number, d: Doctor) => d.id;
  trackBySlot = (_: number, s: Slot) => s.index;
}
