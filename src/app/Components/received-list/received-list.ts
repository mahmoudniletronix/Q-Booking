import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ScheduleServices, Doctor } from '../../service/schedule/schedule-services';
import {
  TicketReservation,
  TicketReservationDto,
  TicketPrintDto,
} from '../../service/ticket-reservation/ticket-reservation';
import { GlobalConfigService } from '../../service/config/global-config-service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface ReservedTicketVm extends TicketReservationDto {
  timeSlot: string;
} // HH:mm:ss

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

  items: ReservedTicketVm[] = [];
  loading = false;

  selectedIds = new Set<number>();
  focusedTicket: ReservedTicketVm | null = null;

  targetDoctorId: number | null = null;
  targetDoctors: Doctor[] = [];

  cancelNote = '';
  orgLogo = '';
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices,
    private ticketSrv: TicketReservation,
    private globalCfg: GlobalConfigService,
    private http: HttpClient
  ) {
    this.globalCfg.load().catch(() => {});
    this.route.paramMap.subscribe((p) => {
      this.clinicId = +(p.get('clinicId') || 0);
      this.doctorId = +(p.get('doctorId') || 0);
      this.day = p.get('day') || '';
      this.dayLabel = this.buildDayLabel(this.day);
      this.ensureDoctorsLoaded();
      this.loadReserved();
      this.orgLogo = this.globalCfg.orgLogo();
    });
  }

  // ================== Load ==================
  private ensureDoctorsLoaded() {
    const existed = this.sch.getDoctorsByClinic(this.clinicId);
    if (!existed || !existed.length) {
      const d = new Date(this.day || new Date());
      this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
    }
    this.targetDoctors = this.sch.getDoctorsByClinic(this.clinicId) || [];
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
        this.focusedTicket = this.items[0] || null;
        this.loading = false;
      },
      error: () => {
        this.items = [];
        this.selectedIds.clear();
        this.focusedTicket = null;
        this.loading = false;
      },
    });
  }

  // ================== Helpers ==================
  private buildDayLabel(raw: string): string {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
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
    const [hh, mm, ss] = hms.split(':');
    return `${(hh ?? '00').padStart(2, '0')}:${(mm ?? '00').padStart(2, '0')}:${(
      ss ?? '00'
    ).padStart(2, '0')}`;
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

  // ================== Selection ==================
  trackById = (_: number, t: ReservedTicketVm) => t.id;

  onTicketClick(t: ReservedTicketVm) {
    if (this.selectedIds.has(t.id)) this.selectedIds.delete(t.id);
    else this.selectedIds.add(t.id);
    this.focusedTicket = t;
  }

  selectAll() {
    this.selectedIds.clear();
    this.items.forEach((i) => this.selectedIds.add(i.id));
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  get allSelected(): boolean {
    return this.items.length > 0 && this.selectedIds.size === this.items.length;
  }

  // ================== Move / Cancel ==================
  canMove(): boolean {
    return (
      this.selectedIds.size > 0 && !!this.targetDoctorId && this.targetDoctorId !== this.doctorId
    );
  }

  moveSelected() {
    if (!this.canMove() || !this.targetDoctorId) return;
    const ids = Array.from(this.selectedIds);
    this.ticketSrv.bulkMove(ids, this.targetDoctorId!).subscribe({
      next: () => {
        const d = new Date(this.day);
        this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
        this.loadReserved();
      },
      error: (err) => {
        console.error('Move tickets error', err);
        alert('❌ Failed to move selected tickets.');
      },
    });
  }

  onDayChange(newDay: string) {
    if (newDay) this.router.navigate(['/patient/received', this.clinicId, this.doctorId, newDay]);
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
        const d = new Date(this.day);
        this.sch.loadSchedule(this.clinicId, d.getFullYear(), d.getMonth() + 1);
        this.cancelNote = '';
        this.loadReserved();
      },
      error: (err) => {
        console.error('Cancel tickets error', err);
        alert('❌ Failed to cancel selected tickets.');
      },
    });
  }

  // ================== PRINT (Preview) ==================
  async printTicket(t: ReservedTicketVm) {
    try {
      const blob = await this.ticketSrv.printFromReservation(t.id).toPromise();
      if (!blob) return;

      const contentType = (blob.type || '').toLowerCase();

      // PDF -> iframe preview
      if (contentType.includes('pdf')) {
        const url = URL.createObjectURL(blob);
        this.openPreviewWindow(
          'Ticket Preview',
          `<iframe src="${url}" style="border:0;width:100%;height:100vh"></iframe>`
        );
        return;
      }

      // JSON -> build dark template
      let asJson: any = null;
      try {
        const txt = await blob.text();
        const parsed = JSON.parse(txt);
        asJson = parsed?.item ?? parsed;
      } catch {
        asJson = null;
      }
      if (asJson && asJson.number) {
        const inner = this.buildDarkTicketHtml(asJson as TicketPrintDto);
        this.openPreviewWindow(`#${asJson.number}`, inner);
        return;
      }

      // Image / other -> preview image
      const url = URL.createObjectURL(blob);
      this.openPreviewWindow(
        'Ticket Preview',
        `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#fff">
          <img src="${url}" style="max-width:100%;max-height:100%" />
        </div>
      `
      );
    } catch (err) {
      console.error('Print error', err);
      alert('❌ Failed to open print preview.');
    }
  }

  private openPreviewWindow(title: string, bodyInnerHtml: string) {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) return;
    const css = `
      *{box-sizing:border-box}body{margin:0;font-family:"Tajawal","Segoe UI",Arial}
      .toolbar{position:fixed;top:0;left:0;right:0;background:#111;color:#fff;padding:8px 12px;display:flex;gap:8px;align-items:center;z-index:10}
      .toolbar .title{font-weight:700;margin-inline-end:auto}
      .toolbar button{border:0;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer}
      .btn-print{background:#22c55e;color:#fff}
      .btn-close{background:#ef4444;color:#fff}
      .content{margin-top:48px}
      @media print {.toolbar{display:none}.content{margin-top:0}}
    `;
    w.document.open();
    w.document.write(`
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8"/><title>${title}</title>
          <style>${css}</style>
        </head>
        <body>
          <div class="toolbar">
            <div class="title">${title}</div>
            <button class="btn-print" onclick="print()">Print</button>
            <button class="btn-close" onclick="close()">Close</button>
          </div>
          <div class="content">${bodyInnerHtml}</div>
        </body>
      </html>
    `);
    w.document.close();
  }

  private buildDarkTicketHtml(dto: TicketPrintDto): string {
    const orgLogo = this.makeAbsoluteUrl(this.globalCfg.orgLogo());
    return `
    <style>
      body{background:#222;color:#fff}
      .wrap{border:1px solid #bbb;padding:12px;border-radius:6px;background:#222;width:100%}
      .logo{text-align:center;margin:8px 0 4px}
      .logo img{max-width:120px;max-height:60px;background:#fff;padding:4px;border-radius:2px}
      .row2{display:flex;justify-content:space-between;font-size:12px;color:#ddd;margin:6px 0}
      .service{text-align:center;font-weight:700;margin:6px 0 2px}
      .num{text-align:center;font-size:26px;font-weight:800;margin:2px 0 10px}
      .hr{height:1px;background:#bbb;margin:10px auto;width:86%;opacity:.9}
      .input{text-align:center;font-size:13px;margin-bottom:4px}
      .foot-line{width:86%;height:1px;background:#bbb;margin:6px auto}
      .pair{width:86%;margin:0 auto;font-size:12px;line-height:1.6}
      .pair .value{font-weight:700}
    </style>
    <div class="wrap">
      <div class="logo"><img src="${orgLogo}" alt="logo"/></div>
      <div class="row2"><div>${dto.printDate}</div><div>${dto.printTime}</div></div>
      <div class="service">${dto.serviceEnglishName}</div>
      <div class="num">${dto.number}</div>
      <div class="hr"></div>
      <div class="input">${dto.customerInput ?? ''}</div>
      <div class="hr" style="width:94%"></div>
      <div class="pair">
        <div><span class="value">${dto.branchName}</span></div>
        <div><span class="value">${dto.waitingCount}</span> عملاء منتظرين</div>
      </div>
      <div class="foot-line"></div>
    </div>
  `;
  }

  editTicket(t: ReservedTicketVm) {
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

  back() {
    this.router.navigate(['/']);
  }
}
