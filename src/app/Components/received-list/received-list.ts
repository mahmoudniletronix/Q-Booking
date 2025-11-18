import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ScheduleServices, Doctor } from '../../service/schedule/schedule-services';
import {
  TicketReservation,
  TicketReservationDto,
  TicketPrintDto,
  TicketReservationUpdateCommand,
} from '../../service/ticket-reservation/ticket-reservation';
import { GlobalConfigService } from '../../service/config/global-config-service';
import { forkJoin, firstValueFrom, Subscription } from 'rxjs';
import { TicketSearchResultDto } from '../../service/global-search/ticket-search-box';
import { AppToastService } from '../../service/Toastr/app-toast.service';
import { LanguageService } from '../../service/lang/language.service';

interface ReservedTicketVm extends TicketReservationDto {
  timeSlot: string;
}

interface DoctorDayOption {
  dateYmd: string;
  dayText: string;
  reserved: number;
  available: number;
  startText: string;
}

@Component({
  selector: 'app-received-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './received-list.html',
  styleUrls: ['./received-list.css'],
})
export class ReceivedList {
  clinicId!: number;
  doctorId!: number;
  day!: string;
  dayLabel = '';
  ticketId?: number;

  private scheduleSub?: Subscription;

  doctorName = '';

  newDayValue = '';

  targetDoctorDays: DoctorDayOption[] = [];
  selectedTargetDay: string | null = null;
  targetDaySlots: string[] = [];
  selectedTargetSlot: string | null = null;
  items: ReservedTicketVm[] = [];
  loading = false;

  selectedIds = new Set<number>();
  focusedTicket: ReservedTicketVm | null = null;

  targetDoctorId: number | null = null;
  targetDoctors: Doctor[] = [];

  searchMode = false;
  searchResults: TicketSearchResultDto[] = [];
  searchTermLabel = '';
  selectedSearchTicket: TicketSearchResultDto | null = null;
  searchPopupOpen = false;

  cancelNote = '';

  editingSlot = false;
  newSlotValue = '';

  ticketMoveSlots: { [id: number]: string | null } = {};

  get selectedTickets(): ReservedTicketVm[] {
    return this.items.filter((i) => this.selectedIds.has(i.id));
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices,
    private ticketSrv: TicketReservation,
    private globalCfg: GlobalConfigService,
    private toast: AppToastService,
    private languageService: LanguageService
  ) {
    this.globalCfg.load().catch(() => {});

    this.scheduleSub = this.sch.scheduleChanged$.subscribe(() => {
      this.targetDoctors = this.sch.getDoctorsByClinic(this.clinicId) || [];
      this.updateDoctorName();
    });

    this.route.paramMap.subscribe((p) => {
      this.clinicId = +(p.get('clinicId') || 0);
      this.doctorId = +(p.get('doctorId') || 0);
      this.day = p.get('day') || '';

      const tid = p.get('ticketId');
      this.ticketId = tid ? Number(tid) : undefined;

      if (this.clinicId) {
        this.sch.setSelectedClinic(this.clinicId);
        localStorage.setItem('qbook.clinicId', String(this.clinicId));
      }
      if (this.doctorId) {
        this.sch.setSelectedDoctor(this.doctorId);
        localStorage.setItem('qbook.doctorId', String(this.doctorId));
      }

      this.dayLabel = this.buildDayLabel(this.day);
      this.ensureDoctorsLoaded();
      this.loadReserved();
    });
  }

  // ================== Load ==================
  ngOnDestroy(): void {
    this.scheduleSub?.unsubscribe();
  }

  // ===== Language helper =====
  isAr(): boolean {
    return this.languageService.lang() === 'ar';
  }

  private ensureDoctorsLoaded() {
    const existed = this.sch.getDoctorsByClinic(this.clinicId);
    if (!existed || !existed.length) {
      const d = new Date(this.day || new Date());
      this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
    }

    this.targetDoctors = existed || [];
    this.updateDoctorName();
  }

  private updateDoctorName() {
    if (!this.clinicId || !this.doctorId) {
      this.doctorName = '';
      return;
    }
    const docs = this.sch.getDoctorsByClinic(this.clinicId) || [];
    const doc = docs.find((d) => d.id === this.doctorId);
    this.doctorName = doc?.name || '';
  }

  private loadReserved() {
    if (!this.doctorId || !this.day) return;

    const apiDateUs = this.formatUsDate(this.day);
    this.loading = true;

    this.ticketSrv.getByServiceAndDate(this.doctorId, apiDateUs).subscribe({
      next: (list) => {
        const mapped = list.map<ReservedTicketVm>((x) => ({
          ...x,
          timeSlot: x.slotTime?.trim()
            ? this.ensureHms(x.slotTime)
            : this.extractTimeHms(x.reservationDate),
        }));

        mapped.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

        this.items = mapped;
        this.selectedIds.clear();
        this.loading = false;

        this.applyTicketFocus();
      },
      error: (err) => {
        console.error('Load reserved tickets error', err);
        this.items = [];
        this.selectedIds.clear();
        this.focusedTicket = null;
        this.loading = false;
        this.toast.error(
          this.isAr()
            ? 'فشل في تحميل حجوزات اليوم، برجاء المحاولة مرة أخرى.'
            : 'Failed to load today reservations. Please try again later.'
        );
      },
    });
  }

  private applyTicketFocus() {
    if (this.ticketId && this.items.length) {
      const match = this.items.find((i) => i.id === this.ticketId);
      if (match) {
        this.selectedIds.clear();
        this.selectedIds.add(match.id);
        this.focusedTicket = match;

        setTimeout(() => {
          const el = document.getElementById('ticket-' + match.id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ticket-focus');
            setTimeout(() => el.classList.remove('ticket-focus'), 1500);
          }
        }, 80);

        return;
      }
    }

    if (this.items.length === 1) {
      this.selectedIds.clear();
      this.selectedIds.add(this.items[0].id);
      this.focusedTicket = this.items[0];
    } else {
      this.focusedTicket = null;
      this.selectedIds.clear();
    }
  }

  // ================== Date helpers for rules ==================

  private normalizeDateOnly(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private isSameDate(value: string | Date | null | undefined): boolean {
    const d = this.normalizeDateOnly(value);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }

  /** يبني تاريخ ووقت التذكرة من reservationDate + timeSlot */
  private buildTicketDateTime(t: ReservedTicketVm): Date | null {
    if (!t?.reservationDate) return null;
    const d = new Date(t.reservationDate);
    if (isNaN(d.getTime())) return null;

    const hms = t.timeSlot || this.extractTimeHms(t.reservationDate);
    if (hms) {
      const [hStr, mStr, sStr] = hms.split(':');
      const h = parseInt(hStr || '0', 10) || 0;
      const m = parseInt(mStr || '0', 10) || 0;
      const s = parseInt(sStr || '0', 10) || 0;
      d.setHours(h, m, s, 0);
    }

    return d;
  }

  canPrintTicket(t: ReservedTicketVm | null): boolean {
    if (!t) return false;
    return this.isSameDate(t.reservationDate);
  }

  canEditTicket(t: ReservedTicketVm | null): boolean {
    if (!t) return false;
    const dt = this.buildTicketDateTime(t);
    if (!dt) return true;
    const now = new Date();
    return dt.getTime() >= now.getTime();
  }

  // ================== (Change Slot) ==================

  private updateTicketSlot(t: ReservedTicketVm, newSlotHms: string) {
    const normalized = this.ensureHms(newSlotHms);
    if (!normalized) {
      this.toast.warning(this.isAr() ? 'من فضلك أدخل وقتًا صحيحًا.' : 'Please enter a valid time.');
      return;
    }

    const cmd: TicketReservationUpdateCommand = {
      id: t.id,
      slotTime: normalized,
      patientName: t.patientName,
      phoneNumber: t.phoneNumber,
      serviceId: t.serviceId,
      branchId: t.branchId,
      reservationDateBase: t.reservationDate,
      isCancel: false,
    };

    this.ticketSrv.updateReservation(cmd).subscribe({
      next: () => {
        t.timeSlot = normalized;
        (t as any).slotTime = normalized;
      },
      error: (err) => {
        console.error('Update ticket error', err);
        this.toast.error(
          this.isAr()
            ? 'فشل في تعديل وقت الحجز، برجاء المحاولة مرة أخرى.'
            : 'Failed to update reservation time. Please try again later.'
        );
      },
    });
  }

  startSlotEdit() {
    if (!this.focusedTicket || !this.canEditTicket(this.focusedTicket)) return;
    const base = this.focusedTicket.timeSlot || '';
    this.newSlotValue = base ? base.substring(0, 5) : '';
    this.editingSlot = true;
  }

  applySlotChange() {
    if (!this.focusedTicket || !this.newSlotValue) return;
    if (!this.canEditTicket(this.focusedTicket)) {
      this.toast.warning(
        this.isAr()
          ? 'لا يمكن تعديل التذكرة بعد مرور وقت الحجز.'
          : 'Ticket cannot be edited after its scheduled time.'
      );
      this.editingSlot = false;
      return;
    }
    const hms = this.newSlotValue + ':00';
    this.updateTicketSlot(this.focusedTicket, hms);
    this.editingSlot = false;
    this.newSlotValue = '';
  }

  cancelSlotEdit() {
    this.editingSlot = false;
    this.newSlotValue = '';
  }

  // ================== Helpers ==================

  private buildDayLabel(raw: string): string {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(this.isAr() ? 'ar-SA' : undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      });
    }
    return raw;
  }

  private formatUsDate(dayYmd: string): string {
    const d = new Date(dayYmd);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  private ensureHms(hms: string): string {
    if (!hms) return '';
    const parts = hms.split(':').map((p) => p.trim());
    const hh = parts[0] ?? '00';
    const mm = parts[1] ?? '00';
    const ss = parts[2] ?? '00';
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}`;
  }

  private extractTimeHms(raw: string): string {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  format12(hms: string): string {
    if (!hms) return '';
    const [hStr, mStr] = hms.split(':');
    let h = parseInt(hStr, 10);
    const m = (mStr || '00').padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  private buildReservationDateBase(newDay: string, t: ReservedTicketVm): string {
    const timeHms = this.ensureHms(t.timeSlot || this.extractTimeHms(t.reservationDate));
    return `${newDay}T${timeHms}`;
  }

  private toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ================== Selection ==================

  trackById = (_: number, t: ReservedTicketVm) => t.id;

  onTicketClick(t: ReservedTicketVm) {
    if (this.selectedIds.has(t.id)) {
      this.selectedIds.delete(t.id);
    } else {
      this.selectedIds.add(t.id);
    }

    if (this.selectedIds.size === 0) {
      this.focusedTicket = null;
      this.editingSlot = false;
      return;
    }

    if (this.selectedIds.size === 1) {
      const onlyId = Array.from(this.selectedIds)[0];
      this.focusedTicket = this.items.find((i) => i.id === onlyId) || null;
    } else {
      this.focusedTicket = null;
      this.editingSlot = false;
    }
  }

  selectAll() {
    this.selectedIds.clear();
    this.items.forEach((i) => this.selectedIds.add(i.id));
    this.focusedTicket = null;
    this.editingSlot = false;

    this.ticketMoveSlots = {};
    this.selectedTargetSlot = null;
  }

  clearSelection() {
    this.selectedIds.clear();
    this.focusedTicket = null;
    this.editingSlot = false;

    this.ticketMoveSlots = {};
    this.selectedTargetSlot = null;
  }

  get allSelected(): boolean {
    return this.items.length > 0 && this.selectedIds.size === this.items.length;
  }

  // ================== Search results ==================

  onSearchResults(results: TicketSearchResultDto[]) {
    if (!results || !results.length) {
      this.clearSearchMode();
      return;
    }

    this.searchMode = true;
    this.searchResults = results;
    this.searchTermLabel =
      results[0]?.patientName || results[0]?.serviceName || results[0]?.phoneNumber || '';
  }

  clearSearchMode() {
    this.searchMode = false;
    this.searchResults = [];
    this.searchTermLabel = '';
    this.selectedSearchTicket = null;
    this.searchPopupOpen = false;
  }

  openSearchTicketPopup(t: TicketSearchResultDto) {
    this.selectedSearchTicket = t;
    this.searchPopupOpen = true;
  }

  closeSearchTicketPopup() {
    this.searchPopupOpen = false;
  }

  // ================== Move / Cancel ==================

  canMove(): boolean {
    if (
      this.selectedIds.size === 0 ||
      !this.targetDoctorId ||
      this.targetDoctorId === this.doctorId ||
      !this.selectedTargetDay ||
      !this.targetDaySlots.length
    ) {
      return false;
    }

    if (this.selectedIds.size === 1) {
      return !!this.selectedTargetSlot;
    }

    for (const id of this.selectedIds) {
      const v = this.ticketMoveSlots[id];
      if (!v) return false;
    }

    return true;
  }

  async moveSelected() {
    if (
      !this.targetDoctorId ||
      !this.selectedTargetDay ||
      !this.targetDaySlots.length ||
      this.selectedIds.size === 0
    ) {
      return;
    }

    const newServiceId = this.targetDoctorId;
    const ids = Array.from(this.selectedIds);
    const targetDay = this.selectedTargetDay;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const t = this.items.find((x) => x.id === id);
      if (!t) continue;

      let slotHms: string | null = null;

      if (this.selectedIds.size === 1) {
        slotHms = this.selectedTargetSlot || null;
      } else {
        slotHms = this.ticketMoveSlots[id] || null;
      }

      if (!slotHms) {
        continue;
      }

      const normalizedSlot = this.ensureHms(slotHms);
      const reservationDateBase = this.buildReservationDateBase(targetDay, t);

      const cmd: TicketReservationUpdateCommand = {
        id: t.id,
        slotTime: normalizedSlot,
        patientName: t.patientName,
        phoneNumber: t.phoneNumber,
        serviceId: newServiceId,
        branchId: t.branchId,
        reservationDateBase,
        isCancel: false,
      };

      try {
        await firstValueFrom(this.ticketSrv.updateReservation(cmd));

        if (i < ids.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error('Move tickets error', err);
        this.toast.error(
          this.isAr()
            ? 'فشل في نقل الحجوزات المحددة، برجاء المحاولة مرة أخرى.'
            : 'Failed to move selected reservations. Please try again later.'
        );
        break;
      }
    }

    const d = new Date(this.day);
    this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
    this.loadReserved();
  }

  canCancel(): boolean {
    return this.selectedIds.size > 0 && !!this.cancelNote.trim();
  }

  cancelSelected() {
    if (!this.canCancel()) return;

    const ids = Array.from(this.selectedIds);
    const note = this.cancelNote.trim();

    this.ticketSrv.bulkCancel(ids, note).subscribe({
      next: () => {
        this.items = this.items.filter((t) => !ids.includes(t.id));
        this.selectedIds.clear();
        this.cancelNote = '';
        this.focusedTicket = null;
      },
      error: (err) => {
        console.error('Cancel tickets error', err);
        this.toast.error(
          this.isAr()
            ? 'فشل في إلغاء الحجوزات المحددة، برجاء المحاولة مرة أخرى.'
            : 'Failed to cancel selected reservations. Please try again later.'
        );
      },
    });
  }

  // ================== Change Day ==================

  canChangeDay(): boolean {
    return !!this.newDayValue && this.selectedIds.size > 0;
  }

  changeDay() {
    if (!this.canChangeDay()) return;

    const newDay = this.newDayValue;
    const ids = Array.from(this.selectedIds);

    const requests = ids
      .map((id) => {
        const t = this.items.find((x) => x.id === id);
        if (!t) return null;

        const timeHms = this.ensureHms(t.timeSlot || this.extractTimeHms(t.reservationDate));

        const cmd: TicketReservationUpdateCommand = {
          id: t.id,
          slotTime: timeHms,
          patientName: t.patientName,
          phoneNumber: t.phoneNumber,
          serviceId: t.serviceId,
          branchId: t.branchId,
          isCancel: false,
          reservationDateBase: this.buildReservationDateBase(newDay, t),
        };

        return this.ticketSrv.updateReservation(cmd);
      })
      .filter((x): x is ReturnType<TicketReservation['updateReservation']> => !!x);

    if (!requests.length) return;

    forkJoin(requests).subscribe({
      next: () => {
        this.day = newDay;
        this.loadReserved();
      },
      error: (err) => {
        console.error('Change day error', err);
        this.toast.error(
          this.isAr()
            ? 'فشل في تغيير اليوم للحجوزات المحددة، برجاء المحاولة مرة أخرى.'
            : 'Failed to change day for selected reservations. Please try again later.'
        );
      },
    });
  }

  // ================== PRINT helpers ==================

  private async printByReservationId(reservationId: number, win?: Window | null) {
    try {
      const blob = await this.ticketSrv.printFromReservation(reservationId).toPromise();
      if (!blob) return;

      console.log('print blob type:', blob.type, 'size:', blob.size);

      let dto: any = null;
      try {
        const txt = await blob.text();
        const parsed = JSON.parse(txt);

        dto = parsed?.response ?? parsed?.item ?? parsed;

        console.log('parsed ticket dto:', dto);
      } catch {
        dto = null;
      }

      if (dto && dto.number) {
        const inner = this.buildLegacyTicketHtml(dto as TicketPrintDto);
        const title = this.isAr() ? `#${dto.number} - تذكرة` : `#${dto.number} - Ticket`;
        this.openPreviewWindow(title, inner, { autoPrint: true, win });
        return;
      }

      const contentType = (blob.type || '').toLowerCase();

      if (contentType.includes('pdf')) {
        const url = URL.createObjectURL(blob);
        this.openPreviewWindow(
          this.isAr() ? 'معاينة التذكرة' : 'Ticket Preview',
          `<iframe id="pdfFrame" src="${url}" style="border:0;width:100%;height:100vh"></iframe>`,
          { autoPrint: true, win }
        );
        return;
      }

      const url = URL.createObjectURL(blob);
      this.openPreviewWindow(
        this.isAr() ? 'معاينة التذكرة' : 'Ticket Preview',
        `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#fff">
         <img src="${url}" style="max-width:100%;max-height:100%" />
       </div>`,
        { autoPrint: true, win }
      );
    } catch (err) {
      console.error('Print error', err);
      this.toast.error(
        this.isAr()
          ? 'فشل في فتح معاينة الطباعة، برجاء المحاولة مرة أخرى.'
          : 'Failed to open ticket print preview. Please try again later.'
      );
    }
  }

  async printTicket(t: ReservedTicketVm) {
    if (!this.canPrintTicket(t)) {
      this.toast.warning(
        this.isAr()
          ? 'لا يمكن طباعة التذكرة إلا في يوم الحجز نفسه.'
          : 'Ticket can only be printed on the reservation day.'
      );
      return;
    }

    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) {
      this.toast.error(
        this.isAr()
          ? 'من فضلك اسمح بالنوافذ المنبثقة (Popups) لطباعة التذاكر.'
          : 'Please allow popups for this site to print tickets.'
      );
      return;
    }

    await this.printByReservationId(t.id, win);
  }

  async printSearchTicket(t: TicketSearchResultDto) {
    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) {
      this.toast.error(
        this.isAr()
          ? 'من فضلك اسمح بالنوافذ المنبثقة (Popups) لطباعة التذاكر.'
          : 'Please allow popups for this site to print tickets.'
      );
      return;
    }

    await this.printByReservationId(t.id, win);
  }

  private openPreviewWindow(
    title: string,
    bodyInnerHtml: string,
    opts?: { autoPrint?: boolean; win?: Window | null }
  ) {
    const w = opts?.win || window.open('', '_blank', 'width=720,height=900');
    if (!w) return;

    const css = `
    *{box-sizing:border-box}
    html,body{margin:0;font-family:"Tajawal","Segoe UI",Arial;-webkit-font-smoothing:antialiased}
    .toolbar{
      position:fixed;top:0;left:0;right:0;background:#111;color:#fff;
      padding:8px 12px;display:flex;gap:8px;align-items:center;z-index:10
    }
    .toolbar .title{font-weight:700;margin-inline-end:auto}
    .toolbar button{border:0;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer}
    .btn-print{background:#22c55e;color:#fff}
    .btn-close{background:#ef4444;color:#fff}

    .content{display:flex;justify-content:center}
    .print-wrap{display:flex;justify-content:center;width:100%}
    .print-page{
      width:80mm; background:#fff;
      page-break-inside:avoid;break-inside:avoid;
    }

    @media print{
      @page { size:80mm auto; margin:0 }
      .toolbar{display:none}
      html,body{width:80mm}
      .print-page{width:80mm;padding:0}
      img{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    }
  `;

    const printScript = `
    <script>
      (function(){
        function waitImages(){
          const imgs=[...document.images];
          return Promise.all(
            imgs.map(i => i.complete ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = r; }))
          );
        }
        async function ready(){
          try { await waitImages(); } catch(e){}
          ${opts?.autoPrint === false ? '' : 'setTimeout(() => window.print(), 300);'}
        }
        if (document.readyState === "complete") ready();
        else addEventListener('load', ready, { once: true });
      })();
    <\/script>
  `;

    const lang = this.isAr() ? 'ar' : 'en';
    const dir = this.isAr() ? 'rtl' : 'ltr';
    const printLabel = this.isAr() ? 'طباعة' : 'Print';
    const closeLabel = this.isAr() ? 'إغلاق' : 'Close';

    w.document.open();
    w.document.write(`
    <html lang="${lang}" dir="${dir}">
      <head>
        <meta charset="utf-8"/><title>${title}</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="toolbar">
          <div class="title">${title}</div>
          <button class="btn-print" onclick="print()">${printLabel}</button>
          <button class="btn-close" onclick="close()">${closeLabel}</button>
        </div>
        <div class="content">
          <div class="print-wrap">
            <div class="print-page">
              ${bodyInnerHtml}
            </div>
          </div>
        </div>
        ${printScript}
      </body>
    </html>
  `);
    w.document.close();
  }

  private buildLegacyTicketHtml(dto: TicketPrintDto): string {
    const orgLogo = this.makeAbsoluteUrl(this.globalCfg.orgLogo());

    const doctorName = this.isAr()
      ? dto.serviceArabicName || dto.serviceEnglishName || ''
      : dto.serviceEnglishName || dto.serviceArabicName || '';

    const clinicName = this.isAr()
      ? dto.parentServiceArabicName || dto.parentServiceEnglishName || ''
      : dto.parentServiceEnglishName || dto.parentServiceArabicName || '';

    const branch = this.isAr()
      ? dto.branchNameAr || dto.branchNameEn || dto.branchName || ''
      : dto.branchNameEn || dto.branchNameAr || dto.branchName || '';

    const wait = dto.waitingCount ?? 0;
    const avgWait = dto.averageWaitingTime;
    const phone = dto.customerInput || '';

    const branchLabel = this.isAr() ? 'الفرع: ' : 'Branch: ';
    const waitingLabel = this.isAr() ? 'عملاء منتظرين: ' : 'Waiting customers: ';
    const avgWaitLabel = this.isAr() ? 'متوسط وقت الانتظار: ' : 'Average waiting time: ';
    const minutesSuffix = this.isAr() ? ' دقيقة' : ' min';
    const doctorPrefix = this.isAr() ? 'د / ' : 'Dr ';

    return `
    <style>
      html, body {
        margin: 0;
        padding: 0;
        font-family: "Tajawal","Segoe UI",Arial,sans-serif;
        -webkit-font-smoothing: antialiased;
        color: #000;
        background: #fff;
      }

      .ticket {
        margin: 0 auto;
        padding: 0 0 2mm 0;
        background: #fff;
        page-break-inside: avoid;
        break-inside: avoid;
        text-align: center;
      }

      .logo { margin: 2mm 0 2mm; }
      .logo img {
        display: block;
        margin: 0 auto;
        max-width: 70mm;
        max-height: 55mm;
      }

      .header {
        display: flex;
        justify-content: space-between;
        font-size: 11pt;
        color: #444;
        padding: 0 6mm;
        margin: 1mm 0 4mm;
      }

      .patient {
        font-size: 14pt;
        font-weight: 800;
        line-height: 1.3;
        margin-bottom: 1mm;
      }

      .clinic {
        font-size: 10pt;
        font-weight: 400;
        line-height: 1.3;
        margin-bottom: 1.5mm;
      }

      .num {
        font-size: 27pt;
        font-weight: 700;
        margin: 1mm 0 -5mm;
        letter-spacing: .5pt;
      }

      .info {
        text-align: ${this.isAr() ? 'right' : 'left'};
        width: 90%;
        margin: 0 auto 3mm;
        font-size: 10pt;
        line-height: 1.6;
      }
      .label { font-weight: 700; }
      .value { font-weight: normal; }

      .site {
        margin: 0 auto;
        text-align: center;
      }
      .site-text {
        font-size: 9pt;
        font-weight: 500;
        color: #000;
        direction: ltr;
        letter-spacing: .3pt;
      }

      @page { size: 80mm auto; margin: 0; }

      @media print {
        html, body { width: 80mm; margin: 0; padding: 0; }
        .ticket    { width: 80mm; margin: 0; padding: 0 0 2mm 0; }
        img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>

    <div class="ticket">
      <div class="logo">
        <img src="${orgLogo}" alt="logo" />
      </div>

      <div class="header">
        <span style="color:#000; margin-inline-start: 10px">${dto.printTime ?? ''}</span>
        <span style="color:#000; margin-inline-end: 10px">${dto.printDate ?? ''}</span>
      </div>

      <div class="clinic">${clinicName}</div>
      <div class="patient">${doctorPrefix}${doctorName}</div>

      <br />
      <div class="num">${dto.number ?? ''}</div>
      <br />
      ${phone ? `<div><span class="value">${phone}</span></div>` : ''}
      <br />
      <div class="info">
        <div>
          <span class="label">${branchLabel}</span>
          <span class="value">${branch}</span>
        </div>

        <div>
          <span class="label">${waitingLabel}</span>
          <span class="value">${wait}</span>
        </div>

        ${
          avgWait != null
            ? `<div><span class="label">${avgWaitLabel}</span> <span class="value">${avgWait}${minutesSuffix}</span></div>`
            : ''
        }
      </div>

      <div class="site">
        <div class="site-text">www.Niletronix.com</div>
      </div>
    </div>
    `;
  }

  editTicket(t: ReservedTicketVm) {
    if (!this.canEditTicket(t)) {
      this.toast.warning(
        this.isAr()
          ? 'لا يمكن تعديل التذكرة بعد مرور وقت الحجز.'
          : 'Ticket cannot be edited after its scheduled time.'
      );
      return;
    }
    this.router.navigate(['/ticket-reservation/edit', t.id]);
  }

  editSearchTicket(t: TicketSearchResultDto) {
    this.router.navigate(['/ticket-reservation/edit', t.id]);
  }

  private makeAbsoluteUrl(src: string | null | undefined): string {
    if (!src) return '';

    if (/^(https?:)?\/\//i.test(src) || /^(data|blob|file):/i.test(src)) {
      return src;
    }

    const trimmed = src.trim();
    const looksLikeRawBase64 = /^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 100;
    if (looksLikeRawBase64) {
      return `data:image/png;base64,${trimmed}`;
    }

    const origin = window.location.origin.replace(/\/+$/, '');
    const path = String(src).replace(/^\/+/, '');
    return `${origin}/${path}`;
  }

  // ================== Target doctor days ==================
  onTargetDoctorChange(id: number | null) {
    this.targetDoctorId = id;
    this.selectedTargetDay = null;
    this.targetDoctorDays = [];

    this.selectedTargetSlot = null;
    this.targetDaySlots = [];
    this.ticketMoveSlots = {};

    if (!id) return;

    this.loadTargetDoctorDays(id);
  }

  private loadTargetDoctorSlots(doctorId: number, dayYmd: string) {
    this.targetDaySlots = [];
    this.selectedTargetSlot = null;
    this.ticketMoveSlots = {};
    const dt = new Date(dayYmd);
    if (isNaN(dt.getTime())) return;

    this.targetDaySlots = [];
    this.selectedTargetSlot = null;

    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;

    this.sch.loadSchedule(this.clinicId, year, month);

    const meta = this.sch.getDayMeta(this.clinicId, doctorId, dt);
    if (!meta) {
      console.warn('No day meta found for target doctor/day');
      return;
    }

    const slotMinutes = meta.waitingDurationMinutes || 30;

    const allSlots: string[] = [];

    const [startH, startM] = (meta.firstStart || '00:00:00')
      .split(':')
      .map((p) => parseInt(p, 10) || 0);
    const [endH, endM] = (meta.lastFinish || '23:59:59')
      .split(':')
      .map((p) => parseInt(p, 10) || 0);

    const cursor = new Date(dt);
    cursor.setHours(startH, startM, 0, 0);

    const end = new Date(dt);
    end.setHours(endH, endM, 0, 0);

    while (cursor <= end) {
      const hh = cursor.getHours().toString().padStart(2, '0');
      const mm = cursor.getMinutes().toString().padStart(2, '0');
      allSlots.push(`${hh}:${mm}:00`);
      cursor.setTime(cursor.getTime() + slotMinutes * 60_000);
    }

    const dateUs = this.formatUsDate(dayYmd);

    this.ticketSrv.getByServiceAndDate(doctorId, dateUs).subscribe({
      next: (reservations) => {
        const reservedSet = new Set(
          (reservations || []).map((r) =>
            this.ensureHms(r.slotTime?.trim() ? r.slotTime : this.extractTimeHms(r.reservationDate))
          )
        );

        this.targetDaySlots = allSlots.filter((s) => !reservedSet.has(this.ensureHms(s)));
      },
      error: (err) => {
        console.error('loadTargetDoctorSlots error', err);
        this.targetDaySlots = [];
      },
    });
  }

  onTargetDayChange(dayYmd: string | null) {
    this.selectedTargetDay = dayYmd;
    this.selectedTargetSlot = null;
    this.targetDaySlots = [];
    this.ticketMoveSlots = {};

    if (!dayYmd || !this.targetDoctorId) return;

    this.loadTargetDoctorSlots(this.targetDoctorId, dayYmd);
  }

  private loadTargetDoctorDays(doctorId: number) {
    if (!this.day) return;

    const baseDate = new Date(this.day);
    if (isNaN(baseDate.getTime())) return;

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();

    const today = new Date();
    let startDay = 1;
    if (today.getFullYear() === year && today.getMonth() === month - 1) {
      startDay = today.getDate();
    }

    const options: DoctorDayOption[] = [];

    for (let dayNum = startDay; dayNum <= lastDay; dayNum++) {
      const dt = new Date(year, month - 1, dayNum);

      const stats = this.sch.countsFor(this.clinicId, doctorId, dt);
      if (!stats.total) continue;

      const ymd = this.toYmd(dt);

      const dayText = dt.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });

      const meta = this.sch.getDayMeta(this.clinicId, doctorId, dt);
      const startHms =
        meta?.firstStart || (meta?.shifts && meta.shifts[0]?.startFrom) || '00:00:00';

      const startText = this.format12(startHms);

      options.push({
        dateYmd: ymd,
        dayText,
        reserved: stats.reserved,
        available: stats.available,
        startText,
      });
    }

    this.targetDoctorDays = options;

    const currentYmd = this.toYmd(baseDate);
    const currentDayOption = options.find((o) => o.dateYmd === currentYmd);
    this.selectedTargetDay = currentDayOption ? currentDayOption.dateYmd : null;
  }

  back() {
    this.router.navigate(['/']);
  }
}
